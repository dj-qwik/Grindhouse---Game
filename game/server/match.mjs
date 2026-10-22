// One match on the server: lobby → intro → countdown → one round (≤ 60 s) → result.
// The server is the only authority: it runs the deterministic simulation, decides the winner, and streams every
// tick's inputs (and the random draws the tick consumed) so browsers can replay it exactly. Disconnected skaters
// keep existing (they just stop moving) until they reconnect; a disconnect is never a refund (bible §4).
import crypto from 'node:crypto'
import { keccak256 } from 'viem'

export const T = {
  INTRO_MS: 4000, // arena card
  COUNT_MS: 3000, // synchronized countdown; the match clock starts at GO
  RESULT_MS: 40000, // results screen linger before the match object is dropped
  FILL_MS: 15000, // free play: fill empty seats with bots after this long
  TICK_MS: 1000 / 60,
  FRAME_EVERY: 2, // ticks per network frame (30 Hz)
  HASH_EVERY: 60, // state fingerprint once a second for desync detection
  MAX_CATCHUP: 12,
}
const P31 = 2147483648, INPUT_LIMIT = P31 * 512, BTN_MASK = 511
const EDGE_BITS = [4, 8, 16, 64, 128, 256] // jump, trick, attack, use, swap, throw: quick taps must register once
const IDLE = 16 | (16 << 5) | (32 << 21)
// Shuffled deck shared across matches: every arena comes up before any repeats.
const DECK = []
function drawArena(keys, avoid) {
  if (!DECK.length) { const fresh = [...keys]; for (let j = fresh.length - 1; j > 0; j--) { const r = crypto.randomInt(j + 1); [fresh[j], fresh[r]] = [fresh[r], fresh[j]] } DECK.push(...fresh) }
  const i = DECK.findIndex((k) => k !== avoid)
  return DECK.splice(i >= 0 ? i : 0, 1)[0]
}
let lastArena = null
// The round seed comes from 32 random bytes: the commitment keccak256(reveal) can't be brute-forced, and the
// simulation seed is derived from the reveal so anyone holding the replay can re-run the round.
const newSeedReveal = () => '0x' + crypto.randomBytes(32).toString('hex')
const simSeed = (reveal) => Number.parseInt(keccak256(reveal).slice(2, 10), 16) >>> 0
const BOT_SKILL = [0.55, 0.82] // keep in sync with src/sim/01_base.js
const BOT_NAMES = ['Gristle', 'Nailbiter', 'Scab', 'Torque', 'Rust', 'Grit', 'Wedge', 'Splint', 'Kink', 'Bolt']

export class Match {
  /**
   * @param {object} o
   * @param {string} o.id
   * @param {'free'|'cash'} o.mode
   * @param {number} o.size seats
   * @param {string} [o.stake] decimal ETH string (cash)
   * @param {(env:object)=>any} o.createSim
   * @param {(m:Match, ev:string, data?:any)=>void} [o.hook] lifecycle hook (settlement, metrics)
   */
  constructor(o) {
    Object.assign(this, { id: o.id, mode: o.mode, size: o.size, stake: o.stake || null, createSim: o.createSim, hook: o.hook || (() => {}) })
    this.seats = []
    this.state = 'lobby'
    this.createdAt = Date.now()
    this.fillAt = 0
    this.round = null; this.frames = []; this.pending = []; this.init = []; this.rec = []
    this.audit = [] // { n, key, seedReveal, players, inputs } — enough for anyone to replay and verify
    this.arenaKeys = Object.keys(o.createSim({}).ARENAS)
    this.names = BOT_NAMES.slice().sort(() => 0.5 - Math.random())
  }

  // ───────────── seats / lobby
  get humans() { return this.seats.filter((s) => s.kind === 'human') }
  get open() { return this.state === 'lobby' && this.seats.length < this.size }
  join(conn, profile) {
    if (!this.open) return null
    const seat = this.newSeat(this.seats.length, profile, conn)
    this.seats.push(seat)
    if (this.mode === 'free' && !this.fillAt) this.fillAt = Date.now() + T.FILL_MS
    this.broadcastLobby()
    if (this.seats.length === this.size) this.start()
    return seat
  }
  newSeat(i, profile, conn) {
    return { i, kind: 'human', name: profile.name, look: profile.look ?? i % 8, user: profile.user, wallet: profile.wallet || null, conn, connected: !!conn, input: IDLE, appliedBtn: 0, pressMask: 0, ready: false }
  }
  leaveLobby(seat) {
    if (this.state !== 'lobby') return
    this.seats.splice(this.seats.indexOf(seat), 1)
    this.seats.forEach((s, k) => { s.i = k })
    if (!this.humans.length) this.close('empty')
    else this.broadcastLobby()
  }
  lobbyMsg(forSeat) {
    return { t: 'lobby', id: this.id, mode: this.mode, size: this.size, stake: this.stake, you: forSeat ? forSeat.i : -1,
      seats: this.seats.map((s) => ({ i: s.i, name: s.name, look: s.look, bot: s.kind === 'bot' })), fillInMs: this.fillAt ? Math.max(0, this.fillAt - Date.now()) : null }
  }
  broadcastLobby() { for (const s of this.humans) this.send(s, this.lobbyMsg(s)) }

  start() {
    // free play tops up with bots so nobody waits forever; cash matches never contain bots
    if (this.mode === 'free') {
      const used = new Set(this.seats.map((s) => s.look))
      while (this.seats.length < this.size) {
        const look = [0, 1, 2, 3, 4, 5, 6, 7].find((l) => !used.has(l)) ?? this.seats.length % 8; used.add(look)
        this.seats.push({ i: this.seats.length, kind: 'bot', name: this.names[this.seats.length % this.names.length], look, skill: BOT_SKILL[0] + Math.random() * (BOT_SKILL[1] - BOT_SKILL[0]), connected: true })
      }
    }
    this.hook(this, 'start')
    for (const s of this.humans) this.send(s, this.matchMsg(s))
    this.beginRound()
  }
  matchMsg(s) {
    return { t: 'match', id: this.id, mode: this.mode, size: this.seats.length, stake: this.stake, you: s.i,
      seats: this.seats.map((x) => ({ i: x.i, name: x.name, look: x.look, bot: x.kind === 'bot' })) }
  }
  playersCfg() { return this.seats.map((s) => ({ i: s.i, name: s.name, look: s.look, skill: s.kind === 'bot' ? s.skill : 0.8 })) }

  // ───────────── the round
  beginRound() {
    const key = drawArena(this.arenaKeys, lastArena); lastArena = key
    const seedReveal = newSeedReveal(), seed = simSeed(seedReveal)
    this.rec = []
    this.round = this.createSim({ seed: 1 }).createRound({ key, seed, players: this.playersCfg(), botSalt: this.id }, { record: this.rec })
    this.init = this.rec.splice(0)
    this.frames = []; this.pending = []
    this.audit = [{ n: 1, key, seedReveal, players: this.seats.map((s) => ({ i: s.i, speedMul: 1 })), inputs: [] }]
    for (const s of this.humans) { s.appliedBtn = 0; s.pressMask = 0 }
    this.phase('intro', T.INTRO_MS)
    this.broadcast(this.roundMsg())
  }
  roundMsg() {
    return { t: 'round', n: 1, key: this.round.key, players: this.playersCfg().map(({ skill, ...p }) => p), init: this.init, introMs: Math.max(0, this.until - Date.now()), countMs: T.COUNT_MS }
  }
  phase(state, ms = 0) { this.state = state; this.until = Date.now() + ms; this.phaseAt = Date.now() }

  // ───────────── the clock: called every few ms by the server loop
  pump(now) {
    if (this.state === 'lobby') { if (this.mode === 'free' && this.fillAt && now >= this.fillAt) this.start(); return }
    if (this.state === 'intro' && now >= this.until) { this.phase('count', T.COUNT_MS); this.broadcast({ t: 'count', ms: T.COUNT_MS }); return }
    if (this.state === 'count' && now >= this.until) { this.phase('play'); this.playStart = now; return }
    if (this.state === 'play') {
      const due = Math.floor((now - this.playStart) / T.TICK_MS)
      let n = 0
      while (this.state === 'play' && this.round.tick < due && n++ < T.MAX_CATCHUP) this.stepTick()
      return
    }
    if (this.state === 'result' && now >= this.until) this.close('finished')
  }
  stepTick() {
    const R = this.round, inputs = {}
    for (const sk of R.sk) {
      const s = this.seats[sk.i]
      if (s.kind === 'bot') continue // the simulation's bot plays it (server-side stream); the value is broadcast
      if (!s.connected) { inputs[sk.i] = IDLE; s.appliedBtn = 0; continue } // disconnected: rolls on, no input
      let p = s.input, low = p % P31, btn = Math.floor(p / P31) & BTN_MASK
      // quick taps between ticks still produce exactly one press edge
      for (const b of EDGE_BITS) if (s.pressMask & b) { if (s.appliedBtn & b) btn &= ~b; else { btn |= b; s.pressMask &= ~b } }
      p = low + btn * P31
      inputs[sk.i] = p; s.appliedBtn = btn
    }
    const w = R.step(inputs)
    const row = R.sk.map((sk) => inputs[sk.i])
    const frame = [row, this.rec.splice(0)]
    this.frames.push(frame); this.pending.push(frame); this.audit[0].inputs.push(row)
    if (R.tick % T.FRAME_EVERY === 0 || w) this.flush()
    if (R.tick % T.HASH_EVERY === 0) this.broadcast({ t: 'h', k: R.tick, h: R.hash() })
    if (w) this.endRound(w)
  }
  flush() {
    if (!this.pending.length) return
    this.broadcast({ t: 'tk', k: this.round.tick - this.pending.length + 1, f: this.pending })
    this.pending = []
  }
  endRound(w) {
    this.flush()
    this.champion = w.i
    this.standings = this.round.standings()
    this.phase('result', T.RESULT_MS)
    this.broadcast({ t: 'end', n: 1, k: this.round.tick, w: w.i, h: this.round.hash(), standings: this.standings, timeout: !!this.round.timeout })
    this.hook(this, 'champion', { winner: w.i, standings: this.standings })
  }
  close(reason) {
    if (this.state === 'closed') return
    this.state = 'closed'
    for (const s of this.humans) { this.send(s, { t: 'closed', reason }); if (s.conn) s.conn.match = null }
    this.hook(this, 'closed', { reason })
  }

  // ───────────── players' messages
  input(seat, p) {
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p >= INPUT_LIMIT) return
    const btn = Math.floor(p / P31) & BTN_MASK, prev = Math.floor(seat.input / P31) & BTN_MASK
    seat.pressMask |= btn & ~prev
    seat.input = p
  }
  disconnect(seat) {
    if (this.state === 'lobby') return this.leaveLobby(seat)
    seat.connected = false; seat.conn = null; seat.input = IDLE
    this.broadcast({ t: 'presence', i: seat.i, on: false })
    if (!this.humans.some((s) => s.connected) && this.mode === 'free') this.close('abandoned')
  }
  reconnect(seat, conn) {
    seat.conn = conn; seat.connected = true; seat.input = IDLE; seat.pressMask = 0
    this.send(seat, this.syncMsg(seat))
    this.broadcast({ t: 'presence', i: seat.i, on: true })
  }
  /** Everything a browser needs to rebuild the current moment exactly (reconnect or desync repair). */
  syncMsg(seat) {
    const base = { t: 'sync', match: this.matchMsg(seat), state: this.state, msLeft: Math.max(0, this.until - Date.now()) }
    if (this.state === 'lobby') return { ...base, lobby: this.lobbyMsg(seat) }
    return { ...base, round: this.roundMsg(), k0: 1, frames: this.frames, end: this.round.winner ? { w: this.round.winner.i, k: this.round.tick, h: this.round.hash(), standings: this.standings } : null }
  }

  send(seat, msg) { if (seat.conn && seat.connected) seat.conn.sendJson(msg) }
  broadcast(msg) { const s = JSON.stringify(msg); for (const x of this.humans) if (x.conn && x.connected) x.conn.sendRaw(s) }
}

#!/bin/sh
# Soundtrack: trims leading/trailing silence, evens loudness (-15 LUFS), 44.1 kHz 160 kbps stereo mp3.
# usage: sh tools/audio/build_music.sh "<folder with the source mp3s>" assets/audio/music
SRC="$1"; OUT="$2"; mkdir -p "$OUT"
enc() { ffmpeg -v error -y -i "$SRC/$1" -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-15:TP=-1.5:LRA=11" -ar 44100 -ac 2 -c:a libmp3lame -b:a 160k "$OUT/$2"; }
enc "Grind House.mp3" grind-house.mp3
enc "Skate4Life.mp3" skate4life.mp3
enc "Friday Nights.mp3" friday-nights.mp3
enc "LongBoardin'.mp3" longboardin.mp3

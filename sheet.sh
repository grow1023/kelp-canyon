#!/bin/bash
# Contact sheet of the 6 poses of a round. Usage: ./sheet.sh r01
D="$(dirname "$0")/cook/$1"
ffmpeg -loglevel error -y -i "$D/p1.png" -i "$D/p2.png" -i "$D/p3.png" -i "$D/p4.png" -i "$D/p5.png" -i "$D/p6.png" -filter_complex "[0][1][2][3][4][5]xstack=inputs=6:layout=0_0|w0_0|0_h0|w0_h0|0_h0+h1|w0_h0+h1,scale=1920:-1" -q:v 3 "$D/sheet.jpg" && echo "$D/sheet.jpg"

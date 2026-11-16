#!/bin/bash
# Run the scripted 60 s fly-through benchmark in the live Chrome session and save the result JSON. Usage: ./bench.sh <name>
D="$(dirname "$0")"; cd "$D"
./ab.sh set viewport 2560 1440 >/dev/null 2>&1
./ab.sh open "http://127.0.0.1:8377/?bench" >/dev/null 2>&1
for i in $(seq 1 45); do sleep 2; r=$(echo 'JSON.stringify(self.__bench||null)' | ./ab.sh eval --stdin 2>/dev/null); [ "$r" != '"null"' ] && [ -n "$r" ] && break; done
python3 -c "import sys,json;d=json.loads(json.loads(sys.argv[1]));json.dump(d,open('out/bench-$1.json','w'),indent=1);print(json.dumps(d))" "$r"

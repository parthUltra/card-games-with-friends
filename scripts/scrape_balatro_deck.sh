#!/usr/bin/env bash
# Download the full 52-card Balatro playing-card deck from the Balatro wiki.
# Source: https://balatrowiki.org/w/Category:Images_-_Playing_cards
# (same art as https://balatrogame.fandom.com/wiki/File:Ace_of_Clubs.png)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
CARDS_DIR="$ROOT/assets/cards"
UA="card-games-with-friends/1.0 (deck scraper)"

mkdir -p \
  "$CARDS_DIR/clubs" \
  "$CARDS_DIR/diamonds" \
  "$CARDS_DIR/hearts" \
  "$CARDS_DIR/spades"

download() {
  local suit_key="$1" suit_name="$2" rank_code="$3" rank_name="$4"
  local url="https://balatrowiki.org/images/${rank_name}_of_${suit_name}.png"
  local dest="$CARDS_DIR/${suit_key}/${rank_code}_of_${suit_key}.png"
  curl -fsSL -A "$UA" --max-time 45 -o "$dest" "$url"
  echo "OK ${rank_name} of ${suit_name}"
}

pids=()
while IFS='|' read -r suit_key suit_name rank_code rank_name; do
  [[ -z "${suit_key:-}" || "$suit_key" == \#* ]] && continue
  download "$suit_key" "$suit_name" "$rank_code" "$rank_name" &
  pids+=($!)
done <<'EOF'
clubs|Clubs|A|Ace
clubs|Clubs|2|2
clubs|Clubs|3|3
clubs|Clubs|4|4
clubs|Clubs|5|5
clubs|Clubs|6|6
clubs|Clubs|7|7
clubs|Clubs|8|8
clubs|Clubs|9|9
clubs|Clubs|10|10
clubs|Clubs|J|Jack
clubs|Clubs|Q|Queen
clubs|Clubs|K|King
diamonds|Diamonds|A|Ace
diamonds|Diamonds|2|2
diamonds|Diamonds|3|3
diamonds|Diamonds|4|4
diamonds|Diamonds|5|5
diamonds|Diamonds|6|6
diamonds|Diamonds|7|7
diamonds|Diamonds|8|8
diamonds|Diamonds|9|9
diamonds|Diamonds|10|10
diamonds|Diamonds|J|Jack
diamonds|Diamonds|Q|Queen
diamonds|Diamonds|K|King
hearts|Hearts|A|Ace
hearts|Hearts|2|2
hearts|Hearts|3|3
hearts|Hearts|4|4
hearts|Hearts|5|5
hearts|Hearts|6|6
hearts|Hearts|7|7
hearts|Hearts|8|8
hearts|Hearts|9|9
hearts|Hearts|10|10
hearts|Hearts|J|Jack
hearts|Hearts|Q|Queen
hearts|Hearts|K|King
spades|Spades|A|Ace
spades|Spades|2|2
spades|Spades|3|3
spades|Spades|4|4
spades|Spades|5|5
spades|Spades|6|6
spades|Spades|7|7
spades|Spades|8|8
spades|Spades|9|9
spades|Spades|10|10
spades|Spades|J|Jack
spades|Spades|Q|Queen
spades|Spades|K|King
EOF

fail=0
for pid in "${pids[@]}"; do
  wait "$pid" || fail=$((fail + 1))
done

if [[ "$fail" -ne 0 ]]; then
  echo "error: $fail downloads failed" >&2
  exit 1
fi

python3 - <<'PY'
import json
import os
import struct
from pathlib import Path

root = Path(os.environ["ROOT"])
cards_dir = root / "assets" / "cards"

ranks = [
    ("A", "Ace", 14), ("2", "2", 2), ("3", "3", 3), ("4", "4", 4),
    ("5", "5", 5), ("6", "6", 6), ("7", "7", 7), ("8", "8", 8),
    ("9", "9", 9), ("10", "10", 10), ("J", "Jack", 11),
    ("Q", "Queen", 12), ("K", "King", 13),
]
suits = [
    ("clubs", "Clubs", "C"),
    ("diamonds", "Diamonds", "D"),
    ("hearts", "Hearts", "H"),
    ("spades", "Spades", "S"),
]

cards = []
for suit_key, suit_name, suit_code in suits:
    for rank_code, rank_name, rank_value in ranks:
        rel = f"assets/cards/{suit_key}/{rank_code}_of_{suit_key}.png"
        path = root / rel
        data = path.read_bytes()
        if not data.startswith(b"\x89PNG"):
            raise SystemExit(f"not a PNG: {path}")
        w, h = struct.unpack(">II", data[16:24])
        if (w, h) != (876, 1164):
            raise SystemExit(f"unexpected size {w}x{h}: {path}")
        cards.append({
            "id": f"{rank_code}{suit_code}",
            "rank": rank_code,
            "rankName": rank_name,
            "rankValue": rank_value,
            "suit": suit_key,
            "suitName": suit_name,
            "suitCode": suit_code,
            "color": "red" if suit_key in ("hearts", "diamonds") else "black",
            "name": f"{rank_name} of {suit_name}",
            "image": rel,
            "sourceUrl": f"https://balatrowiki.org/images/{rank_name}_of_{suit_name}.png",
            "width": w,
            "height": h,
            "bytes": len(data),
        })

deck = {
    "source": "https://balatrowiki.org/w/Category:Images_-_Playing_cards",
    "source_alt": "https://balatrogame.fandom.com/wiki/Category:Images_-_Playing_cards",
    "source_note": "Balatro playing-card art from the Balatro wiki (same assets as balatrogame.fandom.com File:Ace_of_Clubs.png).",
    "count": len(cards),
    "suits": [s[0] for s in suits],
    "ranks": [r[0] for r in ranks],
    "cards": cards,
}

out = cards_dir / "deck.json"
out.write_text(json.dumps(deck, indent=2) + "\n")
print(f"Wrote {deck['count']} cards -> {out}")
PY

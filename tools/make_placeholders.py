#!/usr/bin/env python3
"""Generates the placeholder PNG art for Sandwich Time.

No dependencies (pure Python). Re-running it OVERWRITES the PNGs in assets/,
so only run it if you want the placeholders back.

    python3 tools/make_placeholders.py
"""
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")


def hex_rgba(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for yy in range(cy - ry, cy + ry + 1):
            for xx in range(cx - rx, cx + rx + 1):
                if ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0:
                    self.set(xx, yy, c)

    def art(self, rows, palette, ox=0, oy=0):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != ".":
                    self.set(ox + x, oy + y, palette[ch])

    def scaled(self, s):
        out = Canvas(self.w * s, self.h * s)
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c[3]:
                    out.rect(x * s, y * s, s, s, c)
        return out

    def save(self, path):
        raw = b"".join(
            b"\x00" + bytes(v for p in row for v in p) for row in self.px
        )

        def chunk(tag, data):
            body = tag + data
            return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(raw, 9))
        png += chunk(b"IEND", b"")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(png)
        print("wrote", os.path.relpath(path, os.path.join(ROOT, "..")))


def check(rows, name):
    for i, r in enumerate(rows):
        assert len(r) == 16, f"{name} row {i} is {len(r)} wide"


# ---------------------------------------------------------------- characters
CHEF = [
    "......WWWW......",
    "....WWWWWWWW....",
    "...WWWWWWWWWW...",
    "....WWWWWWWW....",
    "....wwwwwwww....",
    "....HSSSSSSS....",
    "....HSSKSSKS....",
    "....SSSSSSSSS...",
    "....HSSSKKKS....",
    ".....SSSSSS.....",
    "...CCCAAAACCC...",
    "..SCCCAAAACCCS..",
    "..S.CCAAAACC.S..",
    "....PPPPPPPP....",
    "....PPP..PPP....",
    "...BBBB..BBBB...",
]
check(CHEF, "chef")

# shirt, skin, hair, pants
CHEF_VARIANTS = [
    ("#e63946", "#f1c27d", "#4a2c0f", "#1d3557"),
    ("#457bf5", "#8d5524", "#111111", "#2b2d42"),
    ("#2a9d8f", "#ffdbac", "#d4a017", "#3d405b"),
    ("#f4a261", "#c68642", "#5b3a1a", "#264653"),
    ("#9b5de5", "#e0ac69", "#a52a2a", "#22223b"),
    ("#06d6a0", "#ffdbac", "#222222", "#073b4c"),
    ("#ffd166", "#6b4226", "#2b1b0e", "#6d2e46"),
]

# ---------------------------------------------------------------- villains
SODA = [
    ".......gg.......",
    "....KKKKKKKK....",
    "...KggggggggK...",
    "...KRRRRRRRRK...",
    "...KRWWRRWWRK...",
    "...KRWKRRWKRK...",
    "...KRRRRRRRRK...",
    "...KRRKKKKRRK...",
    "...KRRRRRRRRK...",
    "...KWWWWWWWWK...",
    "...KRRRRRRRRK...",
    "...KggggggggK...",
    "....KKKKKKKK....",
    ".....KK..KK.....",
    ".....K....K.....",
    "....KK....KK....",
]
ONION = [
    ".......GG.......",
    "......G..G......",
    ".......GG.......",
    "......PPPP......",
    ".....PPpPPP.....",
    "....PPpPPPPP....",
    "...PPWWPPWWPP...",
    "...PpWKPPWKPP...",
    "..PPpPPPPPPPPP..",
    "..PPpPKKKKPPPP..",
    "..PPpPPPPPPPPP..",
    "...PPpPPPPPPP...",
    "....PPPPPPPP....",
    ".....KK..KK.....",
    ".....K....K.....",
    "....KK....KK....",
]
CUPCAKE = [
    ".......RR.......",
    "......RRRR......",
    ".......RR.......",
    ".....FFFFFF.....",
    "....FFFFFFFF....",
    "...FFfFFFFfFF...",
    "..FFWWFFFFWWFF..",
    "..FFWKFFFFWKFF..",
    "..FFFFFKKFFFFF..",
    "...YYYYYYYYYY...",
    "...YyYyYyYyYY...",
    "....YyYyYyYyY...",
    "....YYYYYYYY....",
    ".....KK..KK.....",
    ".....K....K.....",
    "....KK....KK....",
]
for n, a in (("soda", SODA), ("onion", ONION), ("cupcake", CUPCAKE)):
    check(a, n)

# ---------------------------------------------------------------- title font
FONT = {
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
}


def text_width(text, s):
    return len(text) * 6 * s - s


def draw_text(cv, text, x, y, s, fill, outline):
    for pass_color, offsets in (
        (outline, [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1, 2) if (dx, dy) != (0, 0)]),
        (fill, [(0, 0)]),
    ):
        for ox, oy in offsets:
            cx = x
            for ch in text:
                glyph = FONT.get(ch)
                if glyph:
                    for gy, row in enumerate(glyph):
                        for gx, bit in enumerate(row):
                            if bit == "#":
                                cv.rect(cx + gx * s + ox, y + gy * s + oy, s, s, pass_color)
                cx += 6 * s


def make_title():
    cv = Canvas(200, 110)
    dark = hex_rgba("#3b1d0a")
    for i, (word, color) in enumerate((("SANDWICH", "#ffcc33"), ("TIME", "#ff6b35"))):
        s = 3
        w = text_width(word, s)
        draw_text(cv, word, (cv.w - w) // 2, 6 + i * 28, s, hex_rgba(color), dark)

    # a six-foot sub underneath
    x0, x1, y = 16, 184, 70
    crust, crumb = hex_rgba("#c97a2b"), hex_rgba("#f3d29a")
    cv.rect(x0 + 2, y + 22, x1 - x0 - 4, 6, crust)          # bottom roll
    cv.rect(x0 + 1, y + 20, x1 - x0 - 2, 2, crumb)
    cv.rect(x0 + 1, y + 16, x1 - x0 - 2, 4, hex_rgba("#c23a4e"))  # meat
    for x in range(x0 + 4, x1 - 4, 8):
        cv.rect(x, y + 17, 2, 2, hex_rgba("#8e2236"))
    cv.rect(x0, y + 13, x1 - x0, 3, hex_rgba("#ffcc33"))     # cheese
    for x in range(x0 + 6, x1 - 6, 12):
        cv.rect(x, y + 16, 3, 2, hex_rgba("#ffcc33"))
    cv.rect(x0 + 1, y + 10, x1 - x0 - 2, 3, hex_rgba("#e8352e"))  # tomato
    for x in range(x0, x1, 4):                                # lettuce
        cv.rect(x, y + 7 + (x // 4) % 2, 4, 3, hex_rgba("#3cbf4a"))
    cv.ellipse((x0 + x1) // 2, y + 4, (x1 - x0) // 2, 6, crust)   # top roll
    cv.rect(x0, y + 4, x1 - x0, 4, hex_rgba("#3cbf4a"))
    cv.ellipse((x0 + x1) // 2, y + 2, (x1 - x0) // 2 - 1, 5, crust)
    cv.rect(x0 + 2, y + 5, x1 - x0 - 4, 2, crust)
    for x in range(x0 + 14, x1 - 10, 14):                     # score marks
        cv.rect(x, y, 4, 1, hex_rgba("#8a4d14"))
        cv.rect(x + 2, y - 1, 3, 1, hex_rgba("#f0b45e"))
    for i, x in enumerate(range(x0 + 6, x1 - 6, 7)):           # sesame
        cv.rect(x, y + 1 + (i % 3) - 1, 2, 1, hex_rgba("#fff3d6"))
    return cv


COFFEE = [
    "....s...s.......",
    ".....s...s......",
    "....s...s.......",
    ".....s...s......",
    "................",
    "..KKKKKKKKKK....",
    "..KCCCCCCCCK....",
    "..KWWWWWWWWKKK..",
    "..KWWWWWWWWK.K..",
    "..KRRRRRRRRK.K..",
    "..KWWWWWWWWK.K..",
    "..KWWWWWWWWKKK..",
    "..KwWWWWWWwK....",
    "...KwwwwwwK.....",
    ".KKKKKKKKKKKK...",
    "..KKKKKKKKKK....",
]


def make_coffee():
    cv = Canvas(16, 16)
    cv.art(COFFEE, {"K": hex_rgba("#2b1a10"), "C": hex_rgba("#6f3b1c"), "W": hex_rgba("#f5f1e8"),
                    "w": hex_rgba("#cfc6b4"), "R": hex_rgba("#c1121f"), "s": hex_rgba("#d9d9d9")})
    return cv


def main():
    base = {"K": hex_rgba("#111111"), "W": hex_rgba("#ffffff")}

    for i, (shirt, skin, hair, pants) in enumerate(CHEF_VARIANTS, start=1):
        pal = dict(base)
        pal.update({
            "w": hex_rgba("#cfd8dc"), "S": hex_rgba(skin), "H": hex_rgba(hair),
            "C": hex_rgba(shirt), "A": hex_rgba("#f5f5f5"), "P": hex_rgba(pants),
            "B": hex_rgba("#3e2723"),
        })
        cv = Canvas(16, 16)
        cv.art(CHEF, pal)
        cv.scaled(8).save(os.path.join(ROOT, "characters", f"character{i}.png"))

    villains = {
        "soda": (SODA, {"R": hex_rgba("#d62828"), "g": hex_rgba("#b8c4cc")}),
        "onion": (ONION, {"P": hex_rgba("#d7b4e6"), "p": hex_rgba("#9b6bb5"), "G": hex_rgba("#3cbf4a")}),
        "cupcake": (CUPCAKE, {"R": hex_rgba("#e0102f"), "F": hex_rgba("#ff8fc7"),
                              "f": hex_rgba("#ffd0e8"), "Y": hex_rgba("#5bc0eb"), "y": hex_rgba("#2a8fbd")}),
    }
    for name, (rows, extra) in villains.items():
        pal = dict(base)
        pal.update(extra)
        cv = Canvas(16, 16)
        cv.art(rows, pal)
        cv.scaled(8).save(os.path.join(ROOT, "villains", f"{name}.png"))

    make_title().scaled(4).save(os.path.join(ROOT, "title", "title.png"))

    os.makedirs(os.path.join(ROOT, "bonus"), exist_ok=True)
    make_coffee().scaled(8).save(os.path.join(ROOT, "bonus", "coffee.png"))


if __name__ == "__main__":
    main()

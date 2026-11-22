"""Write scripts/icon.png: 1024x1024 cool grey with four PlayStation-colour stripes. Stdlib only."""
import struct, zlib, pathlib

W = H = 1024
BG = (0xA0, 0xA1, 0xA5)
STRIPES = [(0xD7, 0x26, 0x1E), (0xF2, 0xB6, 0x00), (0x1E, 0x9A, 0x57), (0x1F, 0x5F, 0xBF)]
SW, GAP, SH = 112, 48, 560
x0 = (W - (4 * SW + 3 * GAP)) // 2
y0, y1 = (H - SH) // 2, (H + SH) // 2

def pixel(x, y):
    if y0 <= y < y1:
        for i, c in enumerate(STRIPES):
            sx = x0 + i * (SW + GAP)
            if sx <= x < sx + SW:
                return c
    return BG

rows = b"".join(b"\x00" + bytes(v for x in range(W) for v in pixel(x, y)) for y in range(H))
def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
out = pathlib.Path(__file__).with_name("icon.png")
out.write_bytes(png)
print(out)

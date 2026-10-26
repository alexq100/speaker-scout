"""Build slides.html from slides_src.html: embed screenshots as base64 and the pipeline diagram from the report."""
import base64, pathlib, re

d = pathlib.Path(__file__).parent
src = (d / "slides_src.html").read_text()
report = (d / "report_src.html").read_text()

svg = re.search(r"<svg.*?</svg>", report, re.S).group(0)
src = src.replace("{{svg:pipeline}}", svg)

def img(m):
    data = (d / "images" / (m.group(1) + ".jpg")).read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()

out = re.sub(r"\{\{img:(\w+)\}\}", img, src)
assert "{{" not in out
(d / "slides.html").write_text(out)
print(f"{len(out) / 1e6:.1f} MB")

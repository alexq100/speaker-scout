import base64, re, sys, pathlib
d = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent)
src = (d/"report_src.html").read_text()
def rep(m):
    p = d/"images"/(m.group(1)+".jpg")
    return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()
out = re.sub(r"\{\{img:([\w]+)\}\}", rep, src)
assert "{{img:" not in out
(d/"report.html").write_text(out)
print(len(out)/1e6, "MB")

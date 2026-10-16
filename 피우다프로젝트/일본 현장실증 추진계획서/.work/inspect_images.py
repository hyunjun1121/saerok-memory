import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://www.hancom.co.kr/hwpml/2011/paragraph}"
HC = "{http://www.hancom.co.kr/hwpml/2011/core}"


def inspect(path: str) -> None:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("Contents/section0.xml"))

    table_index = [-1]
    print(f"DOC {path}")

    def walk(element, table=None, cell=None):
        tag = element.tag.rsplit("}", 1)[-1]
        if tag == "tbl":
            table_index[0] += 1
            table = table_index[0]
        if tag == "tc":
            address = element.find(NS + "cellAddr")
            cell = (
                (address.get("rowAddr"), address.get("colAddr"))
                if address is not None
                else None
            )
        if tag == "pic":
            image = element.find(".//" + HC + "img")
            size = element.find(NS + "sz")
            position = element.find(NS + "pos")
            if image is not None and image.get("binaryItemIDRef") in {"image9", "image10"}:
                print(
                    " ",
                    image.get("binaryItemIDRef"),
                    f"table={table}",
                    f"cell={cell}",
                    f"size=({size.get('width')},{size.get('height')})",
                    f"offset=({position.get('horzOffset')},{position.get('vertOffset')})",
                    f"treatAsChar={position.get('treatAsChar')}",
                )
        for child in element:
            walk(child, table, cell)

    walk(root)


for item in sys.argv[1:]:
    inspect(item)

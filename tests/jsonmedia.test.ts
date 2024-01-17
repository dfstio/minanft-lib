/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "@jest/globals";
import fs from "fs/promises";

let json: any = undefined;

describe(`MinaNFT json media`, () => {
  it(`should read json`, async () => {
    json = JSON.parse(
      await fs.readFile("./json/@test76584965347284.json", "utf8")
    );
    //console.log(`json:`, json);
  });

  it(`should load lists from the json`, async () => {
    expect(json).toBeDefined();
    if (json === undefined) return;
    const properties = json.properties;
    expect(properties).toBeDefined();
    if (properties === undefined) return;
    //console.log(`properties:`, properties);

    const media: any = [];
    const audio: any = [];
    const attachments: any = [];
    const texts: any = [];
    const strings: any = [];

    //kind: text string image file map
    //name: description image

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    function iterateProperties(properties: any, level: number = 0) {
      for (const key in properties) {
        console.log(`key:`, key, properties[key]);
        switch (key) {
          case "description":
            if (level > 0) {
              texts.push(properties[key].linkedObject);
            }
            break;
          case "image":
            if (level > 0) {
              media.push(properties[key].linkedObject);
            }
            break;
          default:
            switch (properties[key].kind) {
              case "text":
                texts.push(properties[key].linkedObject);
                break;
              case "string":
                strings.push(properties[key].linkedObject);
                break;
              case "image":
                media.push(properties[key].linkedObject);
                break;
              case "file":
                switch (
                  properties[key].linkedObject.mimeType.replace(/\/[^/.]+$/, "")
                ) {
                  case "audio":
                    audio.push(properties[key].linkedObject);
                    break;
                  case "video":
                    media.push(properties[key].linkedObject);
                    break;
                  case "image":
                    media.push(properties[key].linkedObject);
                    break;
                  case "application":
                    if (
                      properties[key].linkedObject.mimeType ===
                      "application/pdf"
                    )
                      media.push(properties[key].linkedObject);
                    else attachments.push(properties[key].linkedObject);
                    break;
                  default:
                    attachments.push(properties[key].linkedObject);
                    break;
                }
                break;
              case "map":
                iterateProperties(properties[key].properties, level + 1);
                break;
              default:
                throw new Error(`unknown kind: ${properties[key].kind}`);
            }
        }
      }
    }

    iterateProperties(properties);
    /*
    const metadata = {
      media,
      audio,
      attachments,
      texts,
      strings,
    };
    //console.log(`metadata:`, metadata);
    */
    expect(attachments.length).toBe(1);
    expect(media.length).toBe(3);
    expect(audio.length).toBe(1);
    expect(texts.length).toBe(0);
    expect(strings.length).toBe(0);
  });
});

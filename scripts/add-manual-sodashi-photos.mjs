import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { dataDir, loadStore, saveStore, upsertPhoto } from "./lib/store.mjs";

const horseName = "ソダシ";
const source = "manual";
const sourceIdPrefix = "sodashi";
const imageDir = path.join(dataDir, "images", source, sourceIdPrefix);

const photos = [
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20210411桜花賞.jpg",
    file: "sodashi-2021-04-11-ouka-sho.jpg",
    raceDate: "2021-04-11",
    raceName: "桜花賞"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20210523優駿牝馬.jpg",
    file: "sodashi-2021-05-23-oaks.jpg",
    raceDate: "2021-05-23",
    raceName: "オークス"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20211017秋華賞.jpg",
    file: "sodashi-2021-10-17-shuka-sho.jpg",
    raceDate: "2021-10-17",
    raceName: "秋華賞"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20211205チャンピオンズC.jpg",
    file: "sodashi-2021-12-05-champions-cup.jpg",
    raceDate: "2021-12-05",
    raceName: "チャンピオンズカップ"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20220220フェブラリーS.jpg",
    file: "sodashi-2022-02-20-february-s.jpg",
    raceDate: "2022-02-20",
    raceName: "フェブラリーS"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20220515ヴィクトリアマイル.jpg",
    file: "sodashi-2022-05-15-victoria-mile.jpg",
    raceDate: "2022-05-15",
    raceName: "ヴィクトリアマイル"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20221120マイルチャンピオンシップ.jpg",
    file: "sodashi-2022-11-20-mile-cs.jpg",
    raceDate: "2022-11-20",
    raceName: "マイルCS"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20230514ヴィクトリアマイル.jpg",
    file: "sodashi-2023-05-14-victoria-mile.jpg",
    raceDate: "2023-05-14",
    raceName: "ヴィクトリアマイル"
  },
  {
    src: "/Users/gue1971/Desktop/馬/名馬写真/2018ソダシ★★★/ソダシ20230604安田記念.jpg",
    file: "sodashi-2023-06-04-yasuda-kinen.jpg",
    raceDate: "2023-06-04",
    raceName: "安田記念"
  }
];

const db = await loadStore();
const horse = db.horses.find((item) => item.name === horseName && item.birthYear === 2018);
if (!horse) throw new Error(`${horseName} not found`);

await mkdir(imageDir, { recursive: true });

let copied = 0;
let upserted = 0;

for (const [index, photo] of photos.entries()) {
  const localPath = path.join("images", source, sourceIdPrefix, photo.file);
  await copyFile(photo.src, path.join(dataDir, localPath));
  copied += 1;
  upsertPhoto(db, {
    horseId: horse.id,
    source,
    sourceId: `${sourceIdPrefix}-${photo.raceDate}`,
    sourcePageUrl: "",
    imageUrl: "",
    localImagePath: localPath,
    caption: `${photo.raceDate} ${photo.raceName}`,
    raceName: photo.raceName,
    photoDate: photo.raceDate,
    issueDate: photo.raceDate,
    sourceOrder: index + 1,
    comment: "",
    publishedDate: photo.raceDate,
    raceKey: `${photo.raceDate.slice(0, 4)}:${photo.raceName}`,
    raceDate: photo.raceDate,
    raceDateSource: "manual"
  });
  upserted += 1;
}

await saveStore(db);

console.log(`copied images: ${copied}`);
console.log(`upserted photos: ${upserted}`);

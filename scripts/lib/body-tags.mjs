export const bodyTagDefinitions = [
  {
    tag: "長躯短背",
    category: "体型",
    confirmed: [/長躯短背/, /長躯[^。]*短背/],
    suggested: [/背中[^。]*短[^。]*(?:腹|胴)[^。]*(?:長|伸び)/, /(?:腹|胴)[^。]*(?:長|伸び)[^。]*背中[^。]*短/]
  },
  {
    tag: "胴長",
    category: "体型",
    confirmed: [/胴長/, /背中[^。]*長/, /胴[^。]*長/],
    suggested: [/胴[^。]*伸び/, /伸び(?:やか|のある)[^。]*(?:馬体|体型|フォルム)/]
  },
  {
    tag: "胴詰まり",
    category: "体型",
    confirmed: [/胴詰まり/, /寸(?:の)?詰まり/, /詰まった体型/, /詰まった馬体/],
    suggested: [/コンパクト[^。]*(?:まとま|体型|馬体)/, /背中[^。]*短[^。]*(?:腹|胴)[^。]*短/]
  },
  {
    tag: "脚長",
    category: "体型",
    confirmed: [/脚長/, /四肢[^。]*長/, /手脚[^。]*長/, /前肢[^。]*長/, /脚[^。]*長/],
    suggested: [/四肢[^。]*長く見せ/, /跳び[^。]*大き/]
  },
  {
    tag: "前肢短",
    category: "体型",
    confirmed: [/前肢[^。]*短/],
    suggested: []
  },
  {
    tag: "胸深",
    category: "体型",
    confirmed: [/胸深/, /胸[^。]*深/, /胸の縦幅[^。]*深/],
    suggested: [/心臓・肺[^。]*容量[^。]*大/, /心肺機能[^。]*高/]
  },
  {
    tag: "低重心",
    category: "体型",
    confirmed: [/低重心/, /重心[^。]*低/],
    suggested: []
  },
  {
    tag: "首長",
    category: "体型",
    confirmed: [/(?:首|クビ)さし[^。]*長/, /首[^。]*長/],
    suggested: []
  },
  {
    tag: "首短",
    category: "体型",
    confirmed: [/(?:首|クビ)さし[^。]*短/, /首[^。]*短/],
    suggested: []
  },
  {
    tag: "直飛",
    category: "骨格",
    confirmed: [/直飛/, /飛節[^。]*真っ?すぐ/, /真っ?すぐ[^。]*飛節/],
    suggested: [/飛節[^。]*伸び/]
  },
  {
    tag: "曲飛",
    category: "骨格",
    confirmed: [/曲飛/, /飛節[^。]*(?:カーブ|湾曲)/],
    suggested: [/飛節[^。]*緩やか/]
  },
  {
    tag: "斜尻",
    category: "骨格",
    confirmed: [/斜尻/, /仙骨[^。]*傾斜/, /仙骨[^。]*角度[^。]*傾斜/],
    suggested: []
  },
  {
    tag: "肩立ち",
    category: "骨格",
    confirmed: [/肩[^。]*立ち/, /肩のライン[^。]*立ち気味/],
    suggested: []
  },
  {
    tag: "肩傾斜",
    category: "骨格",
    confirmed: [/肩[^。]*傾斜/, /肩[^。]*寝/],
    suggested: []
  },
  {
    tag: "繋ぎ立ち",
    category: "骨格",
    confirmed: [/繋ぎ[^。]*立ち/, /繋[^。]*立ち気味/],
    suggested: []
  },
  {
    tag: "繋ぎ柔らか",
    category: "骨格",
    confirmed: [/繋ぎ[^。]*柔らか/, /繋ぎ[^。]*クッション/],
    suggested: [/繋ぎ[^。]*長さ[^。]*クッション/]
  }
];

export function extractBodyTags(comment = "") {
  const text = String(comment).replace(/\s+/g, "");
  if (!text) return [];
  const sentences = splitSentences(text);
  return bodyTagDefinitions.flatMap((definition) => {
    const confirmed = findEvidence(sentences, definition.confirmed);
    const suggested = confirmed.length ? [] : findEvidence(sentences, definition.suggested);
    const evidence = confirmed.length ? confirmed : suggested;
    if (!evidence.length) return [];
    return [{
      tag: definition.tag,
      category: definition.category,
      confidence: confirmed.length ? "confirmed" : "suggested",
      evidence
    }];
  });
}

function findEvidence(sentences, patterns) {
  return sentences.filter((sentence) => {
    if (isNegated(sentence)) return false;
    return patterns.some((pattern) => pattern.test(sentence));
  }).slice(0, 3);
}

function splitSentences(text) {
  return text
    .split(/(?<=。)/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isNegated(sentence) {
  return /(?:ではない|でない|見せない|感じない|目立たない|欠ける|乏しい|短く見せず)/.test(sentence);
}

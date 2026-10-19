# Test Proofreader — Chrome extension

किसी भी test / quiz / mock-test website को खोलें, extension चालू करें और page को
एक बार scroll करें। Extension पढ़ते-पढ़ते ही गलतियाँ पकड़ कर page पर highlight
कर देता है और एक panel में list कर देता है, ताकि आप उन्हें correct कर सकें।

## क्या-क्या check होता है

| Check | कैसे | कब |
| --- | --- | --- |
| **Calculation** — `25 + 17 = 43`, `20% of 450 = 80` | Extension खुद हिसाब लगाता है | तुरंत (offline) |
| **Spelling** — repeated word (`the the`), आम गलत spellings, Hindi में दो बार लगी मात्रा | Built-in list | तुरंत |
| **Duplicate** — एक ही question दो बार, मिलता-जुलता question, दो एक जैसे options | Text compare | तुरंत |
| **Broken content** — image load नहीं हुई, `\frac` जैसा LaTeX code, `&amp;`, `undefined`, `�` | Page check | तुरंत |
| **Grammar / punctuation** — `|` की जगह `।`, bracket अधूरा, comma के बाद space नहीं | Rules | तुरंत |
| **AI deep check** — हर question दोबारा solve करके answer key / solution check, grammar, गलत fact, ambiguous question, कोई सही option नहीं, figure/passage गायब, Hindi–English version में फर्क | Claude AI | "AI deep check" दबाने पर |

हर problem के साथ: गलत text → सही text, कारण, और **Show on page** (सीधे उसी जगह ले
जाता है), **Copy correction**, **✓ Mark fixed**। पूरी list **Export CSV** (Excel में
खुलती है, Hindi सही दिखती है) या **Copy report** से भेज सकते हैं।

## Install (5 मिनट, एक बार)

1. यह ZIP download करें:
   **https://github.com/AditriKaushik/index/releases/download/proofreader-latest/test-proofreader.zip**
   और unzip करें (right-click → Extract All)। Unzip किया folder किसी पक्की जगह रखें — उसे delete न करें।
2. Chrome में `chrome://extensions` खोलें।
3. ऊपर दाएँ **Developer mode** on करें।
4. **Load unpacked** दबाएँ और unzip किया हुआ folder चुनें (जिसके अंदर `manifest.json` है)।
5. Toolbar में puzzle (🧩) icon से **Test Proofreader** को pin कर लें।

नया version आने पर: नया ZIP उसी folder में unzip करें, फिर `chrome://extensions` पर extension के ↻ (reload) icon को दबाएँ।

## Use कैसे करें

1. Test की website खोलें (login वगैरह जैसे आप हमेशा करते हैं)।
2. Extension icon दबाएँ → **▶ Start on this page** (shortcut: `Alt+Shift+P`, फिर Start)।
3. Page को ऊपर से नीचे scroll करें — या panel में **⇣ Auto-scroll page** दबाएँ।
   एक-एक question वाले test में बस **Next** दबाते जाएँ; हर नया question अपने-आप check होता है।
4. **✦ AI deep check** दबाएँ — अब तक पढ़ा गया सारा content AI से check होता है।
5. Panel में problem पर click करें → page पर वह जगह दिखेगी। Correct करके **✓ Mark fixed** दबाएँ।

Highlight के रंग: 🔴 high (गलत answer / calculation / question बेकार) · 🟠 medium (spelling/grammar) · 🔵 low (छोटी बातें)।

## AI deep check की setting

Extension popup → **Settings** में अपनी Claude API key डालें
([console.anthropic.com](https://console.anthropic.com/settings/keys) से बनती है)।

- **Model**: Opus 5.5 (सबसे accurate, default) · Sonnet 5.5 (तेज़/सस्ता) · Haiku 5.5 (सबसे सस्ता)
- **Thoroughness**: maths वाले papers के लिए *High* रखें।
- *Run AI check automatically after auto-scroll* tick करने पर auto-scroll खत्म होते ही AI check चल जाता है।

Offline checks के लिए key की ज़रूरत नहीं है।

## Privacy

- Offline checks पूरी तरह आपके browser में चलते हैं।
- AI deep check दबाने पर ही page का text (सिर्फ़ text, images नहीं) Anthropic के API
  को जाता है। API key सिर्फ़ आपके browser में save रहती है।
- Extension तभी page पढ़ता है जब आप **Start** दबाते हैं; बाकी websites को वह छूता नहीं।

## Try करने के लिए demo

`demo/test-page.html` में जान-बूझकर डाली गई गलतियों वाला एक mock test है
(गलत calculation, गलत answer key, duplicate question, duplicate option, spelling,
टूटी image, unrendered LaTeX)। GitHub Pages पर:
`https://aditrikaushik.github.io/index/proofreader-extension/demo/test-page.html`

## Limits

- Canvas या image के अंदर लिखा text नहीं पढ़ा जा सकता (scanned PDF / image वाले questions)।
- दूसरी website से load होने वाले iframe के अंदर का content नहीं पढ़ा जाता।
- `chrome://` pages, Chrome Web Store और Chrome का PDF viewer scan नहीं होते।
- Page reload करने पर list साफ़ हो जाती है — पहले **Export CSV** कर लें।

## Developers

```
proofreader-extension/
├─ manifest.json      MV3 manifest (activeTab + scripting; host permission only for api.anthropic.com)
├─ popup.html/js      Start button + settings
├─ checks.js          offline checks (pure functions, also used by tests)
├─ content.js         page scanner, highlights (CSS Custom Highlight API), floating panel
├─ page.css           highlight styles injected into the page
├─ background.js      Claude API call (structured JSON output)
├─ demo/test-page.html
└─ test/checks.test.mjs   node --test proofreader-extension/test/checks.test.mjs
```

Highlights use `CSS.highlights`, so the page's own DOM is never rewritten — safe
on React/Angular test apps.

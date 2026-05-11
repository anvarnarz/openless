<p align="center">
  <img src="openless-all/app/src-tauri/icons/128x128@2x.png" alt="OpenLess" width="160" />
</p>

<h1 align="center">OpenLess UZ</h1>

<p align="center">
  <strong>O'zbek tilida ovozli kiritish — har qanday ilovada.</strong><br/>
  Tugmani bosing, gapiring, qo'yib yuboring — AI tomonidan tahrirlangan matn kursoringizda paydo bo'ladi.
</p>

<p align="center">
  [English README available below / Inglizcha quyida]
</p>

<p align="center">
  <a href="https://github.com/appergb/openless/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/appergb/openless?style=flat-square&color=2c5282" /></a>
  <a href="https://github.com/appergb/openless/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/appergb/openless?style=flat-square&color=2f855a" /></a>
  <img alt="macOS" src="https://img.shields.io/badge/macOS-12%2B-1f425f?style=flat-square" />
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2B-0078d4?style=flat-square" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24c8db?style=flat-square" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-2021-ce422b?style=flat-square" />
</p>

---

## Bu fork haqida (About this fork)

Bu — [Open-Less/openless](https://github.com/Open-Less/openless) loyihasining forki bo'lib, O'zbek tilidagi foydalanuvchilar uchun moslashtirilgan. Asosiy loyiha MIT litsenziyasi ostida chiqarilgan.

**Upstream loyihadan farqlari:**

- Interfeys tili sukut bo'yicha **O'zbekcha** (sozlamalardan o'zgartirish mumkin)
- AI tahrirlovchi sukut bo'yicha **Google Gemini 2.5 Flash** (OpenAI-mos endpoint orqali)
- Nutqni matnga aylantirish (ASR) sukut bo'yicha **Whisper HTTP** (Volcengine o'rniga)
- Tarjima maqsad tili sukut bo'yicha **Inglizcha**
- Qayta brendlash yo'q — xuddi shu ilova, xuddi shu bundle ID, xuddi shu tugmalar

---

## Asosiy xususiyatlar (Features)

- **Global tugma (hotkey)** — istalgan ilovada yozing: ChatGPT, Claude, Cursor, Notion, email, messenjer
- **4 ta chiqish rejimi** — ham qanday matn uchun mos variant:
  - Xom matn / Raw — transkriptni o'zgartirishsiz kiritadi
  - Engil tahrirlash / Light polish — tinish belgilari, grammatika, keraksiz so'zlar tozalanadi
  - Tuzilgan so'rov / Structured prompt — nutqingizni AI uchun batafsil va tuzilgan promptga aylantiradi
  - Rasmiy uslub / Formal — rasmiy hujjatlar, xatlar uchun
- **Tarjima tugmasi** — o'zbekcha gapiring, inglizcha (yoki boshqa tilda) matn kiritiladi
- **Lug'at (Dictionary)** — maxsus so'zlar, nomlar, texnik atamalar uchun
- **Tarix (History)** — so'nggi diktovkalar ro'yxati
- **Tizim paneli belgisi (Tray icon)** va mini holatlar kapsulasi
- **Ko'p tilli interfeys** — O'zbek, Ingliz, Xitoy, Yapon, Koreys tillari

---

## O'rnatish (Installation)

### macOS

1. [Releases](../../releases) sahifasidan yuklab oling:
   - Apple Silicon uchun: `OpenLess_<version>_aarch64.dmg`
   - Intel Mac uchun: `OpenLess_<version>_x64.dmg`

2. DMG faylini oching, OpenLess.app ni `/Applications` papkasiga sudrang.

3. **Muhim:** ilova Apple tomonidan notarizatsiya qilinmagan, shuning uchun Terminal orqali Gatekeeper ogohlantirmasini olib tashlang:
   ```bash
   xattr -cr /Applications/OpenLess.app
   ```
   Bu buyruqsiz ilova "shikastlangan" deb ochilmasligi mumkin.

4. Ilovani ishga tushiring va so'ralgan ruxsatlarni bering:
   - **Mikrofon ruxsati** — birinchi yoqilganda so'raladi, bering.
   - **Accessibility (Maxsus imkoniyatlar) ruxsati** — System Settings → Privacy & Security → Accessibility bo'limiga o'ting, OpenLess ni ro'yxatdan topib, yoqing.
   - **Diqqat:** Accessibility ruxsati berilgandan keyin ilovani **to'liq yoping va qayta oching** — bu ruxsat faqat qayta ishga tushirishdan keyin kuchga kiradi. Aksincha, global tugma ishlamaydi.

5. Settings bo'limiga o'ting va API kalitlarini kiriting (quyidagi "Sozlash" bo'limiga qarang).

### Windows

1. [Releases](../../releases) sahifasidan `OpenLess_<version>_x64-setup.exe` yuklab oling.
2. Faylni ishga tushiring va o'rnatishni yakunlang.
3. Ilova birinchi marta ochilganda Mikrofon ruxsatini bering.
4. Settings → Permissions bo'limida global tugma faolligini tekshiring.
5. Settings bo'limida API kalitlarini kiriting.

---

## Sozlash (Configuration)

Ilovani ishlatish uchun ikkita API kaliti kerak. Ularni **Settings → Recording** va **Settings → Polish** bo'limlarida kiriting.

### 1. Whisper ASR — Nutqni matnga aylantirish

Nutq tanish uchun Whisper-mos server kerak.

| Maydon | Qiymat |
|--------|--------|
| Provider | Whisper HTTP |
| API Key | *OpenAI API kalitingiz* |
| Endpoint | `https://api.openai.com/v1/audio/transcriptions` (sukut) |

**API kalit olish:** [platform.openai.com](https://platform.openai.com) da ro'yxatdan o'ting → API Keys bo'limida yangi kalit yarating.

> Istalgan Whisper-mos endpoint ishlatish mumkin (masalan, o'zingizning local server).

### 2. Gemini Polish — Matn tahriri va prompt tuzish

Matnni tartibga solish uchun Google Gemini ishlatiladi.

| Maydon | Qiymat |
|--------|--------|
| Provider | Gemini (OpenAI-mos endpoint) |
| API Key | *Google AI Studio kalitingiz* |
| Model | `gemini-2.5-flash` (oldindan to'ldirilgan) |
| Endpoint | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (o'zgartirmang) |

**API kalit olish:** [aistudio.google.com](https://aistudio.google.com) ga kiring → "Get API key" tugmasini bosing.

> **Eslatma:** API kalit maydonlari ataylab bo'sh qoldirilgan — ularni siz to'ldirishingiz kerak. Saqlashdan keyin darhol kuchga kiradi, ilovani qayta ishga tushirish shart emas.

---

## Foydalanish (Usage)

1. **Diktovka boshlash:** sozlangan global tugmani bosing (sukut: `Right Option` yoki `Right Alt`), gapiring, tugmani yana bosing — matn kursoringizga kiritiladi.
2. **Bekor qilish:** yozish jarayonida `Esc` tugmasini bosing — istalgan bosqichda (yozish, tahlil, kiritish) bekor qiladi.
3. **Chiqish rejimini o'zgartirish:** asosiy oynada yoki kapsulada kerakli rejimni tanlang.
4. **Tarjima:** tarjima tugmasini (sukut: `Cmd/Ctrl+Shift+T`) bosib, o'zbekcha gapiring — inglizcha matn kiritiladi.
5. **Lug'at:** Settings → Dictionary bo'limida maxsus so'zlarni qo'shing. Ular ASR va tahrirda avtomatik qo'llaniladi.

---

## Chiqish rejimlari (Output modes)

| Rejim | Nomi (EN) | Tavsif |
|-------|-----------|--------|
| Xom matn | Raw | Transkript o'zgartirishsiz kiritiladi |
| Engil tahrirlash | Light polish | Grammatika, tinish belgilari, keraksiz to'ldiruvchi so'zlar tozalanadi |
| Tuzilgan so'rov | Structured prompt | Nutq ChatGPT/Claude uchun batafsil, tuzilgan promptga aylantiriladi |
| Rasmiy uslub | Formal | Xatlar, hujjatlar uchun rasmiy til |

---

## Manba koddan qurish (Build from source)

```bash
git clone --branch beta https://github.com/YOUR_FORK/openless-uz
cd openless-uz
git submodule update --init --recursive
cd openless-all/app
npm ci

# Ishlab chiqish rejimi (Vite + Tauri)
npm run tauri dev

# macOS uchun release build
./scripts/build-mac.sh
INSTALL=0 ./scripts/build-mac.sh   # faqat qurish, o'rnatmasdan

# TypeScript tekshirish
npm run build

# Rust tekshirish
cargo check --manifest-path src-tauri/Cargo.toml
```

Loglар: `~/Library/Logs/OpenLess/openless.log` (macOS) / `%LOCALAPPDATA%\OpenLess\Logs\openless.log` (Windows).

---

## Litsenziya (License)

MIT — asosiy loyiha: [Open-Less/openless](https://github.com/Open-Less/openless).
Bu fork ham xuddi shu litsenziya ostida tarqatiladi.

---

---

## English Summary

**OpenLess UZ** is a fork of [OpenLess](https://github.com/Open-Less/openless) (MIT), an open-source voice-input app for macOS and Windows. Press a global hotkey, speak, release — AI-polished text is inserted at your cursor in any app.

### What this fork changes

| Setting | Upstream default | This fork's default |
|---------|-----------------|---------------------|
| UI language | 简体中文 | O'zbekcha (Uzbek) |
| ASR provider | Volcengine streaming | Whisper HTTP |
| LLM/polish provider | Ark (ByteDance) | Google Gemini 2.5 Flash |
| Translation target | (disabled) | English |

No rebranding — same bundle ID (`com.openless.app`), same binary, same hotkey behavior.

### Installation

**macOS:** Download the `.dmg` from [Releases](../../releases), drag to `/Applications`, then run:
```bash
xattr -cr /Applications/OpenLess.app
```
Grant Microphone and Accessibility permissions; **quit and reopen after granting Accessibility** or the global hotkey won't install.

**Windows:** Run the `.exe` installer from [Releases](../../releases), grant Microphone when prompted.

### Two API keys required

**1. Whisper ASR** (speech-to-text) — Settings → Recording:
- Get key at [platform.openai.com](https://platform.openai.com)
- Any Whisper-compatible endpoint works

**2. Gemini Polish** (text cleanup / prompt structuring) — Settings → Polish:
- Get key at [aistudio.google.com](https://aistudio.google.com)
- Model (`gemini-2.5-flash`) and endpoint are pre-filled — only the API key needs to be entered

Both fields are intentionally blank on first launch. Changes take effect immediately after saving — no restart needed.

### Build

```bash
git submodule update --init --recursive
cd openless-all/app && npm ci
npm run tauri dev          # dev
npm run build              # TS check
cargo check --manifest-path src-tauri/Cargo.toml  # Rust check
```

See [CLAUDE.md](CLAUDE.md) for full architecture, module map, and contributing rules.

### License

MIT — upstream: [Open-Less/openless](https://github.com/Open-Less/openless)

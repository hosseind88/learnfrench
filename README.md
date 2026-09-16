# learnfrench

اپ آموزش زبان فرانسه سطح A1 برای فارسی‌زبان‌ها.

واژگان، جملات کتاب *Communication essentielle A1*، فلش‌کارت، آزمون، گرامر و افزودن جمله با AI.

## اجرا

فایل `index.html` را با یک سرور محلی باز کنید:

```bash
python3 -m http.server 3000
```

سپس به [http://localhost:3000](http://localhost:3000) بروید.

برای تحلیل جمله با AI، کلید OpenRouter را در صفحه «افزودن جمله با AI» وارد کنید. کلید را در ریپو نگذارید.

## یادگیری با انیمیشن

جمله‌های فرانسه را به اسکریپت بدهید تا ترجمه و عکس انیمیشنی بسازد و در بخش «یادگیری با انیمیشن» نشان داده شود.

پیش‌فرض [آروان](https://docs.arvancloud.ir/fa/aiaas/api-usage/) است. AvalAI هم به‌عنوان گزینه دوم مانده:

```bash
# پیش‌فرض: ترجمه و عکس با آروان
python3 tools/generate_learning_scenes.py --provider arvan

# فقط AvalAI
python3 tools/generate_learning_scenes.py --provider avalai
```

در `.env` این‌ها را بگذارید (این فایل را commit نکنید):

```bash
ARVAN_API_KEY="your-arvan-key"
ARVAN_ENDPOINT="https://api.arvancloudai.ir"
ARVAN_TEXT_MODEL="Gemini-2.5-Flash-lite"
ARVAN_IMAGE_MODEL="Gemini-3.1-Flash-Image-Preview"
AVALAI_API_KEY="your-avalai-key"
LEARNING_AI_PROVIDER=arvan
```

خروجی در `learning-scenes/scenes.json` و `learning-scenes/images/` ذخیره می‌شود.

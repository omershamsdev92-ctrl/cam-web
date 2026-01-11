# تعليمات إعداد Twilio SMS

## بعد الحصول على بيانات Twilio:

1. أنشئ ملف جديد باسم `.env` في مجلد المشروع الرئيسي
2. انسخ المحتوى التالي وعدّل البيانات:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here_32_characters
TWILIO_PHONE=+1234567890
PORT=3000
```

3. استبدل:
   - `ACxxxxxxxx...` بـ Account SID الخاص بك من Twilio Console
   - `your_auth_token...` بـ Auth Token الخاص بك
   - `+1234567890` برقم الهاتف الذي حصلت عليه من Twilio

4. احفظ الملف

5. ثبّت المكتبات:
   ```bash
   npm install
   ```

6. أعد تشغيل السيرفر:
   ```bash
   npm start
   ```

## التحقق من التفعيل:
عند تشغيل السيرفر، يجب أن ترى:
✓ Twilio SMS service enabled

إذا رأيت:
⚠ Twilio not configured - SMS will use device method
فهذا يعني أن البيانات غير صحيحة أو الملف .env غير موجود.

---

## روابط مهمة:
- Twilio Console: https://console.twilio.com
- الحصول على رقم تجريبي: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
- Account SID & Auth Token: https://console.twilio.com/us1/account/keys-credentials/api-keys

## ملاحظات:
- الحساب التجريبي يعطيك $15 رصيد مجاني
- يمكنك إرسال رسائل فقط للأرقام التي قمت بتأكيدها في الحساب التجريبي
- لإرسال رسائل لأي رقم، ستحتاج لترقية الحساب (بعد استنفاد الرصيد المجاني)

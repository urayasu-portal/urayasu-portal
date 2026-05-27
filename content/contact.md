---
title: "お問い合わせ"
date: 2024-01-01T00:00:00+09:00
noDate: true
---

ご質問・情報提供・掲載依頼など、お気軽にお問い合わせください。

<form class="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
  <div class="form-group">
    <label for="name">お名前 <span class="required">*</span></label>
    <input type="text" id="name" name="name" required placeholder="例：浦安 太郎">
  </div>
  <div class="form-group">
    <label for="email">メールアドレス <span class="required">*</span></label>
    <input type="email" id="email" name="email" required placeholder="例：info@example.com">
  </div>
  <div class="form-group">
    <label for="subject">題名</label>
    <input type="text" id="subject" name="subject" placeholder="例：イベント情報の提供について">
  </div>
  <div class="form-group">
    <label for="message">メッセージ本文</label>
    <textarea id="message" name="message" rows="6" placeholder="お問い合わせ内容をご記入ください。"></textarea>
  </div>
  <button type="submit">送信する</button>
</form>

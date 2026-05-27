---
title: "お問い合わせ"
date: 2024-01-01T00:00:00+09:00
noDate: true
---

<div class="contact-intro">
  <h2>地域情報・掲載依頼の窓口</h2>
  <p>
    浦安ぽーたるでは、浦安市・新浦安・舞浜・周辺エリアの地域情報を募集しています。<br>
    新店舗のオープン、閉店、イベント、地域ニュース、店舗・サービスの掲載相談などがありましたら、以下のフォームよりお気軽にお知らせください。
  </p>
  <ul class="contact-type-list">
    <li>📢 開店・閉店情報を知らせる</li>
    <li>🎪 イベント掲載を依頼する</li>
    <li>🏪 店舗・サービス掲載について相談する</li>
    <li>✏️ 誤りを報告する</li>
    <li>📣 広告・PR掲載について相談する</li>
  </ul>
</div>

<!-- 将来: 広告・PR掲載の詳細ページへのリンクをここに追加予定 -->

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

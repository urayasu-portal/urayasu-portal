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
    <li><button type="button" class="contact-type-btn" data-value="開店・閉店情報の提供"><i class="ti ti-building-store" aria-hidden="true"></i> 開店・閉店情報を知らせる</button></li>
    <li><button type="button" class="contact-type-btn" data-value="イベント掲載の依頼"><i class="ti ti-calendar-event" aria-hidden="true"></i> イベント掲載を依頼する</button></li>
    <li><button type="button" class="contact-type-btn" data-value="店舗・サービス掲載の相談"><i class="ti ti-building-community" aria-hidden="true"></i> 店舗・サービス掲載について相談する</button></li>
    <li><button type="button" class="contact-type-btn" data-value="誤りの報告"><i class="ti ti-flag-2" aria-hidden="true"></i> 誤りを報告する</button></li>
    <li><button type="button" class="contact-type-btn" data-value="広告・PR掲載の相談"><i class="ti ti-speakerphone" aria-hidden="true"></i> 広告・PR掲載について相談する</button></li>
  </ul>
</div>

<script>
document.querySelectorAll('.contact-type-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var val = this.getAttribute('data-value');
    var sel = document.getElementById('subject');
    if (sel) {
      sel.value = val;
      sel.dispatchEvent(new Event('change'));
    }
    document.querySelectorAll('.contact-type-btn').forEach(function(b) {
      b.classList.remove('contact-type-btn--active');
    });
    this.classList.add('contact-type-btn--active');
    var form = document.querySelector('.contact-form');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
</script>

<!-- 将来: 広告・PR掲載の詳細ページへのリンクをここに追加予定 -->

<form class="contact-form" action="https://formsubmit.co/urayasu.portal@gmail.com" method="POST">
  <!-- formsubmit.co 設定 -->
  <input type="hidden" name="_subject" value="【浦安ぽーたる】お問い合わせ">
  <input type="hidden" name="_next" value="https://urayasu-portal.com/thanks/">
  <input type="hidden" name="_captcha" value="false">
  <input type="hidden" name="_template" value="table">
  <!-- スパム対策ハニーポット -->
  <input type="text" name="_honey" style="display:none">

  <div class="form-group">
    <label for="name">お名前 <span class="required">*</span></label>
    <input type="text" id="name" name="name" required placeholder="例：浦安 太郎">
  </div>
  <div class="form-group">
    <label for="email">メールアドレス <span class="required">*</span></label>
    <input type="email" id="email" name="email" required placeholder="例：info@example.com">
  </div>
  <div class="form-group">
    <label for="subject">お問い合わせの種類</label>
    <select id="subject" name="subject">
      <option value="">選択してください</option>
      <option value="開店・閉店情報の提供">開店・閉店情報を知らせる</option>
      <option value="イベント掲載の依頼">イベント掲載を依頼する</option>
      <option value="店舗・サービス掲載の相談">店舗・サービス掲載について相談する</option>
      <option value="誤りの報告">誤りを報告する</option>
      <option value="広告・PR掲載の相談">広告・PR掲載について相談する</option>
      <option value="その他">その他</option>
    </select>
  </div>
  <div class="form-group">
    <label for="message">メッセージ本文 <span class="required">*</span></label>
    <textarea id="message" name="message" rows="6" required placeholder="お問い合わせ内容をご記入ください。"></textarea>
  </div>
  <button type="submit" class="contact-submit-btn">送信する →</button>
</form>

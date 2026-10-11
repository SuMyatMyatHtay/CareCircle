
<script setup>
import { computed } from 'vue'

const user = computed(() => {
  try {
    return JSON.parse(sessionStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
})

const firstName = computed(() =>
  user.value.name?.trim().split(/\s+/)[0] || 'friend'
)
</script>

<template>
  <div class="empty-home">
    <!-- Top navigation -->
    <header class="home-header">
      <RouterLink to="/home" class="home-logo">
        <span class="logo-heart">♥</span>
        <span>Care<span class="logo-green">Circle</span></span>
      </RouterLink>

      <div class="header-right">
        <span class="header-message">Made with love ♡</span>
        <div class="user-avatar" :title="user.name || 'Your profile'">
          {{ firstName.charAt(0).toUpperCase() }}
        </div>
      </div>
    </header>

    <!-- Main welcome section -->
    <main class="home-content">
      <div class="welcome-pill">
        <span>✿</span>
        A LITTLE SPACE FOR A LOT OF LOVE
        <span>✿</span>
      </div>

      <h1>Hello, {{ firstName }}! <span>♡</span></h1>
      <p class="welcome-subtitle">
        Every caring journey begins with a little circle of love.
      </p>

      <!-- Cute illustration -->
      <div class="family-illustration" aria-hidden="true">
        <span class="floating-heart heart-one">♥</span>
        <span class="floating-heart heart-two">♥</span>
        <span class="floating-star star-one">✦</span>
        <span class="floating-star star-two">✧</span>

        <div class="illustration-circle">
          <div class="character grandma">👵🏻</div>
          <div class="character dad">👨🏻</div>
          <div class="character mom">👩🏻</div>
          <div class="character child">👧🏻</div>
          <div class="illustration-heart">💗</div>
          <div class="illustration-ground"></div>
        </div>

        <span class="flower flower-left">🌷</span>
        <span class="flower flower-right">🌼</span>
      </div>

      <!-- Empty family message -->
      <section class="empty-message">
        <div class="empty-badge">🌱 YOUR STORY STARTS HERE</div>
        <h2>No family circle yet!</h2>
        <p>
          It looks like you haven't joined a family circle.
          That's okay! Let's bring your loved ones together
          and make caring a little easier.
        </p>
      </section>

      <!-- Action choices -->
      <div class="family-actions">
        <RouterLink to="/create-family" class="action-card create-card">
          <div class="action-icon create-icon">🏡</div>
          <div class="action-text">
            <h3>Create a family</h3>
            <p>
              Start your own little circle and invite your loved ones.
            </p>
            <span class="action-link">Create my circle <span>→</span></span>
          </div>
        </RouterLink>

        <RouterLink to="/join-family" class="action-card join-card">
          <div class="action-icon join-icon">💌</div>
          <div class="action-text">
            <h3>Join a family</h3>
            <p>
              Got an invitation? Your family is waiting for you!
            </p>
            <span class="action-link">Join a circle <span>→</span></span>
          </div>
        </RouterLink>
      </div>

      <div class="home-footer-message">
        <span>♥</span>
        Together, even the smallest acts of care make a big difference.
        <span>♥</span>
      </div>
    </main>

    <footer class="home-footer">
      CareCircle ♡ Care together, closer always.
    </footer>
  </div>
</template>

<style scoped>
.empty-home {
  --green: #6DBF7C;
  --peach: #FFB3A7;
  --text: #2F2F2F;
  min-height: 100vh;
  background:
    radial-gradient(circle at 10% 40%, #E8F5E9 0, transparent 24%),
    radial-gradient(circle at 90% 55%, #FFE8E3 0, transparent 25%),
    #FBF8F7;
  font-family: 'Nunito', system-ui, sans-serif;
  color: var(--text);
}

.home-header {
  max-width: 1200px;
  margin: auto;
  padding: 22px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.home-logo {
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  color: #363636;
  font-size: 25px;
  font-weight: 900;
  letter-spacing: -1px;
}

.logo-heart {
  color: var(--peach);
  font-size: 37px;
  text-shadow: -5px -3px #91CDAA;
}

.logo-green { color: #569C78; }

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-message {
  color: #8D958D;
  font-size: 13px;
}

.user-avatar {
  width: 43px;
  height: 43px;
  background: #DFF1E4;
  color: #468B69;
  border: 3px solid white;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 900;
  box-shadow: 0 3px 12px #376F4920;
}

.home-content {
  max-width: 900px;
  padding: 24px 24px 65px;
  margin: auto;
  text-align: center;
}

.welcome-pill, .empty-badge {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  padding: 9px 18px;
  border-radius: 30px;
  background: #E5F3E9;
  color: #4C9B6B;
  font-size: 11px;
  letter-spacing: 1.5px;
  font-weight: 900;
}

.home-content h1 {
  margin: 20px 0 8px;
  font-size: clamp(32px, 5vw, 49px);
  font-weight: 900;
  letter-spacing: -1.5px;
}

.home-content h1 span { color: #FF9D96; }

.welcome-subtitle {
  color: #7C807D;
  font-size: 16px;
}

.family-illustration {
  position: relative;
  width: min(100%, 390px);
  height: 255px;
  margin: 14px auto 7px;
}

.illustration-circle {
  position: absolute;
  width: 285px;
  height: 220px;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  background: #E2F1E4;
  border-radius: 48% 52% 44% 46%;
  overflow: hidden;
  border: 7px solid #FFFDF9;
  box-shadow: 0 14px 38px #76A98A24;
}

.character {
  position: absolute;
  line-height: 1;
  filter: drop-shadow(0 5px 3px #547B6720);
}

.grandma {
  font-size: 83px;
  left: 28px;
  top: 23px;
}

.dad {
  font-size: 88px;
  right: 22px;
  top: 20px;
}

.mom {
  font-size: 90px;
  left: 70px;
  bottom: 11px;
  z-index: 2;
}

.child {
  font-size: 66px;
  right: 35px;
  bottom: 8px;
  z-index: 3;
}

.illustration-heart {
  position: absolute;
  top: 22px;
  left: 120px;
  font-size: 29px;
}

.illustration-ground {
  position: absolute;
  bottom: -23px;
  left: -10px;
  width: 310px;
  height: 70px;
  background: #C6E4CE;
  border-radius: 50%;
}

.floating-heart, .floating-star, .flower {
  position: absolute;
  z-index: 4;
}

.floating-heart {
  color: #FFA99E;
  animation: float 3s ease-in-out infinite;
}

.heart-one { top: 28px; left: 27px; font-size: 33px; }
.heart-two { top: 81px; right: 29px; font-size: 22px; animation-delay: 1s; }
.star-one { top: 12px; right: 70px; color: #F8C766; font-size: 33px; }
.star-two { top: 100px; left: 3px; color: #8BCBA4; font-size: 27px; }
.flower { bottom: 8px; font-size: 40px; }
.flower-left { left: 6px; }
.flower-right { right: 7px; }

.empty-message { max-width: 540px; margin: 0 auto 26px; }

.empty-badge {
  background: #FFF1D8;
  color: #A97F38;
  padding: 7px 14px;
  font-size: 10px;
}

.empty-message h2 {
  font-size: 30px;
  font-weight: 900;
  margin: 13px 0 9px;
}

.empty-message p {
  line-height: 1.75;
  color: #777C78;
  font-size: 15px;
}

.family-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  max-width: 740px;
  margin: auto;
  text-align: left;
}

.action-card {
  min-width: 0;
  padding: 24px;
  border-radius: 24px;
  text-decoration: none;
  color: #333;
  display: flex;
  align-items: flex-start;
  gap: 15px;
  border: 2px solid transparent;
  box-shadow: 0 10px 28px #6D867512;
  transition: transform .2s, box-shadow .2s;
}

.action-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px #6D867525;
  color: #333;
}

.action-card:focus-visible {
  outline: 3px solid #2D7556;
  outline-offset: 3px;
}

.create-card {
  background: #F0F8F0;
  border-color: #D3EAD8;
}

.join-card {
  background: #FFF0EB;
  border-color: #FFE0D7;
}

.action-icon {
  width: 65px;
  height: 65px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 32px;
  border-radius: 20px;
}

.create-icon { background: #D8EFDC; }
.join-icon { background: #FFDFD6; }

.action-text h3 {
  margin: 3px 0 7px;
  font-size: 18px;
  font-weight: 900;
}

.action-text p {
  color: #777F79;
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 15px;
}

.action-link {
  font-weight: 900;
  font-size: 13px;
  color: #448C64;
}

.join-card .action-link { color: #DE8377; }

.action-link span { margin-left: 6px; }

.home-footer-message {
  margin-top: 37px;
  color: #93A095;
  font-size: 13px;
}

.home-footer-message span {
  color: #F1ADA2;
  padding: 0 6px;
}

.home-footer {
  text-align: center;
  padding: 20px;
  color: #9DA79E;
  font-size: 12px;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@media (prefers-reduced-motion: reduce) {
  .floating-heart { animation: none; }
  .action-card { transition: none; }
}

@media (max-width: 650px) {
  .home-header { padding: 16px 20px; }
  .header-message { display: none; }
  .home-content { padding: 18px 18px 45px; }
  .family-actions { grid-template-columns: 1fr; max-width: 410px; }
  .action-card { padding: 20px; }
  .family-illustration { transform: scale(.9); margin: 0 auto; }
}
</style>

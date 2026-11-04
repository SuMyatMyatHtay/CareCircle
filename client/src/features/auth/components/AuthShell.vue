<script setup>
import BrandLogo from '../../../components/common/BrandLogo.vue'
import familyArt from '../../../assets/family-banner.png'
import './auth-design.css'
</script>

<template>
  <main class="cc-auth">
    <div class="cc-auth-frame">
      <aside class="cc-auth-hero" aria-label="About CareCircle">
        <RouterLink class="cc-auth-brand" to="/login" aria-label="CareCircle login">
          <BrandLogo class="cc-auth-logo" />
          <span><span class="cc-auth-wordmark">CareCircle</span><small>Care together, closer always</small></span>
        </RouterLink>
        <div class="cc-hero-body">
          <div class="cc-hero-copy">
            <h1>
              <span>Together for a</span>
              <span class="cc-brand-accent">brighter tomorrow.</span>
            </h1>

            <p>
              Care, support and share the journey
              <span>because family is always stronger together.</span>
            </p>
          </div>

          <div class="cc-hero-picture">
            <img :src="familyArt" alt="CareCircle family" />
          </div>
        </div>
        <p class="cc-hero-caption">A little support makes a big difference <span>♥</span></p>
      </aside>
      <section class="cc-auth-main" aria-label="Account access">
        <div class="cc-auth-mobile-brand">
          <RouterLink class="cc-auth-brand" to="/login"
            ><BrandLogo class="cc-auth-logo" /><span class="cc-auth-wordmark">CareCircle</span></RouterLink
          >
        </div>
        <div class="cc-auth-form">
          <div class="auth-card"><slot /></div>
        </div>
        <p class="cc-auth-foot d-md-none">Made with <span>♥</span> for families everywhere.</p>
      </section>
    </div>
  </main>
</template>

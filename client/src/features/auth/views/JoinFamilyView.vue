<script setup></script>
<template>
  <div class="row justify-content-center mt-4">
    <div class="col-lg-6">
      <div class="card p-4">
        <div class="eyebrow">Family invitation</div>
        <h1>Join a family circle</h1>
        <p class="muted">Use a family invitation code to share care plans and tasks.</p>
        <label class="form-label">Invitation code</label><input class="form-control" value="TAN-2026" readonly />
        <p class="demo-note mt-3">Demo only: invitation validation will be implemented by the authentication owner.</p>
        <RouterLink class="btn btn-primary" to="/family">Preview Tan Family →</RouterLink>
      </div>
    </div>
  </div>
</template>

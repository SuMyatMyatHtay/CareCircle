<script setup>
// Faint empty bar shown where a not-yet-built section will put its text.
//   <BlankLine width="60%" />
defineProps({
    width: { type: String, default: '100%' },
    height: { type: String, default: '12px' }
})
</script>

<template>
    <span class="blank-line" :style="{ width, height }" aria-hidden="true"></span>
</template>

<style scoped>
.blank-line {
    display: block;
    max-width: 100%;
    margin: 5px 0;
    border-radius: 6px;
    background: currentColor;
    opacity: 0.12;
}
</style>

<script setup>
// White rounded panel with a heading. Content goes in the default slot,
// optional buttons/links next to the heading go in the "actions" slot.
//   <SectionCard title="Recent updates"> ... </SectionCard>
defineProps({
    title: { type: String, required: true }
})
</script>

<template>
    <section class="section-card">
        <header class="section-card-header">
            <h2 class="section-card-title">{{ title }}</h2>
            <slot name="actions"></slot>
        </header>
        <slot></slot>
    </section>
</template>

<style scoped>
.section-card {
    height: 100%;
    padding: 22px 20px;
    background: var(--care-panel, white);
    border: 1px solid var(--care-border, #E4ECE5);
    border-radius: 16px;
}

.section-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
}

.section-card-title {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: var(--care-text, #2F2F2F);
}
</style>

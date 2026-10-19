<script setup>
// Page heading for Family Home: greeting + subtitle, with buttons in the "actions" slot.
defineProps({
    title: { type: String, required: true },
    subtitle: { type: String, default: '' }
})
</script>

<template>
    <header class="home-header">
        <div>
            <h1>{{ title }}</h1>
            <p v-if="subtitle">{{ subtitle }}</p>
        </div>
        <slot name="actions"></slot>
    </header>
</template>

<style scoped>
.home-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
}

h1 {
    margin-bottom: 3px;
    font-size: 31px;
    font-weight: 900;
}

p {
    margin: 0;
    color: #7B8391;
    font-size: 15px;
}

@media (max-width: 767px) {
    h1 {
        font-size: 25px;
    }
}
</style>

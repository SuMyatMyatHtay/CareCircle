<script setup>
// PLACEHOLDER (owner: E, Chaithra). Live transit banner, static data for now.
import BlankLine from './BlankLine.vue'

defineProps({
    session: { type: Object, required: true }
})

const emit = defineEmits(['view-live'])
</script>

<template>
    <section class="transit-banner" aria-label="Live transit">
        <div class="avatars" aria-hidden="true">
            <span class="avatar">{{ session.recipientAvatar }}</span>
            <span class="avatar">{{ session.companionAvatar }}</span>
        </div>

        <div class="banner-text">
            <strong v-if="session.headline">{{ session.headline }}</strong>
            <BlankLine v-else width="55%" height="16px" />
            <span v-if="session.detail" class="detail">{{ session.detail }}</span>
            <BlankLine v-else width="35%" />
        </div>

        <button type="button" class="view-live" @click="emit('view-live')">View live</button>
    </section>
</template>

<style scoped>
.transit-banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    padding: 18px 20px;
    margin-bottom: 28px;
    background: #E8F5E9;
    border-radius: 16px;
}

.avatars {
    display: flex;
}

.avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 2px solid #E8F5E9;
    border-radius: 50%;
    background: white;
    font-size: 24px;
}

.avatar + .avatar {
    margin-left: -12px;
}

.banner-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 200px;
}

strong {
    font-size: 17px;
    color: #2F2F2F;
}

.detail {
    font-size: 14px;
    color: #7B8391;
}

.view-live {
    padding: 9px 16px;
    border: 1px solid #DCE8DE;
    border-radius: 10px;
    background: white;
    font-size: 14px;
    font-weight: 600;
}
</style>

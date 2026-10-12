<script setup>
// PLACEHOLDER (owner: F, SeungHak). Recent activity feed, static data for now.
import SectionCard from '../../../../components/common/SectionCard.vue'
import BlankLine from './BlankLine.vue'

defineProps({
    updates: { type: Array, default: () => [] }
})
</script>

<template>
    <SectionCard title="Recent updates">
        <ul class="updates">
            <li v-for="update in updates" :key="update.id" class="update">
                <span class="avatar" aria-hidden="true">{{ update.avatar }}</span>
                <div class="update-text">
                    <p v-if="update.text">{{ update.text }}</p>
                    <BlankLine v-else width="90%" />
                    <small v-if="update.time">{{ update.time }}</small>
                    <BlankLine v-else width="35%" height="9px" />
                </div>
            </li>
        </ul>
    </SectionCard>
</template>

<style scoped>
.updates {
    margin: 0;
    padding: 0;
    list-style: none;
}

.update {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
}

.avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #FDF3E4;
    font-size: 17px;
}

.update-text {
    flex: 1;
}

p {
    margin: 0 0 2px;
    font-size: 14px;
    color: #2F2F2F;
}

small {
    color: #7B8391;
    font-size: 12px;
}
</style>

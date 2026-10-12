<script setup>
// The frame for every logged-in page: sidebar on the left, the page on the right.
// Pages are rendered by <RouterView /> and should not include their own sidebar.
import { onMounted } from 'vue'
import FamilySidebar from './FamilySidebar.vue'
import { useActiveFamily } from '../../composables/useActiveFamily.js'

const { families, selectedFamilyId, loadFamilies, selectFamily } = useActiveFamily()

let user = {}
try {
    user = JSON.parse(sessionStorage.getItem('user') || '{}')
} catch {
    user = {}
}

// Reload whenever the layout appears, e.g. after creating or joining a family
onMounted(loadFamilies)
</script>

<template>
    <div class="app-layout">
        <FamilySidebar :families="families" :selected-family-id="selectedFamilyId" :user="user"
            @select-family="selectFamily" />

        <main class="app-main">
            <RouterView />
        </main>
    </div>
</template>

<style scoped>
.app-layout {
    display: flex;
    min-height: 100vh;
    background: #FCFBF8;
    color: #2F2F2F;
    font-family: 'Nunito', system-ui, sans-serif;
}

.app-main {
    flex: 1;
    min-width: 0;
    padding: 29px 32px;
}

@media (max-width: 767px) {
    .app-layout {
        flex-direction: column;
    }

    .app-main {
        padding: 25px 18px;
    }
}
</style>
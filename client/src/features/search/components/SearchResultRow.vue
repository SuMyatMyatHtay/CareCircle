<script setup>
// Owner: Marcus (D)
// One search hit (Figma cc/Search result): lead tile, title, muted meta line, status pill.
// Only the row's content; the parent wraps it in a listbox option or a link.
//   <SearchResultRow kind="task" :item="task" query="eye" />
//   kind: 'task' | 'log' | 'person' | 'place'
//   variant: 'compact' (dropdown), 'page' (results page) or 'card' (phone)
import { computed } from 'vue'
import CareAvatar from '../../../components/common/CareAvatar.vue'
import TaskStatusBadge from '../../tasks/components/TaskStatusBadge.vue'
import HighlightText from './HighlightText.vue'
import { describeResult } from '../searchFormat.js'

const props = defineProps({
    kind: { type: String, required: true },
    item: { type: Object, required: true },
    query: { type: String, default: '' },
    variant: { type: String, default: 'compact' }
})

const row = computed(() => describeResult(props.kind, props.item, { variant: props.variant }))
</script>

<template>
    <span class="search-row" :class="`search-row--${variant}`">
        <template v-if="variant !== 'card'">
            <CareAvatar v-if="row.avatar" class="search-avatar" :person="row.avatar" size="small" />
            <span v-else class="search-lead" :class="`search-lead--${row.lead.tone}`" aria-hidden="true">
                {{ row.lead.text }}
            </span>
        </template>

        <span class="search-row-text">
            <span class="search-row-title"><HighlightText :text="row.title" :query="query" /></span>
            <span v-if="row.quote" class="search-row-quote"><HighlightText :text="row.quote" :query="query" /></span>
            <span v-if="row.meta.length" class="search-row-meta">
                <template v-for="(part, index) in row.meta" :key="index">
                    <template v-if="index"> · </template>
                    <HighlightText v-if="part.mark" :text="part.text" :query="query" />
                    <template v-else>{{ part.text }}</template>
                </template>
            </span>
        </span>

        <TaskStatusBadge v-if="row.status" class="search-row-status" :status="row.status" :needs-transit="item.needsTransit" />
    </span>
</template>

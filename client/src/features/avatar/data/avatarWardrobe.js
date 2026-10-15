export const categories = [
  { id: 'bases', label: 'Characters', icon: 'bi-person-hearts' },
  { id: 'dresses', label: 'Dresses', icon: 'bi-heart' },
  { id: 'tops', label: 'Tops', icon: 'bi-stars' },
  { id: 'skirts', label: 'Skirts', icon: 'bi-flower1' },
  { id: 'shorts', label: 'Shorts', icon: 'bi-grid' },
  { id: 'accessories', label: 'Accessories', icon: 'bi-gem' }
]

const bases = ['cat', 'dog', 'fox', 'elephant', 'dinosaur', 'rabbit', 'chick', 'duck']
export const lockedBases = ['rabbit', 'chick', 'duck']

export const wardrobe = {
  bases: bases.map(name => ({
    id: name,
    name: name[0].toUpperCase() + name.slice(1),
    image: `/avatars/bases/${name}.png`,
    comingSoon: lockedBases.includes(name)
  })),
  ...Object.fromEntries(
    ['dresses', 'tops', 'skirts', 'shorts', 'accessories'].map(category => [
      category,
      Array.from({ length: 12 }, (_, i) => ({
        id: `${category}-${String(i + 1).padStart(2, '0')}`,
        name: `${category === 'accessories' ? 'Accessory'
          : category === 'shorts' ? 'Shorts'
          : category === 'skirts' ? 'Skirt'
          : category === 'dresses' ? 'Dress' : 'Top'} ${i + 1}`,
        image: `/avatars/${category}/${category}-${String(i + 1).padStart(2, '0')}.png`
      }))
    ])
  )
}

export const defaultAppearance = () => ({
  baseId: 'cat',
  equipped: { dress: '', top: '', bottom: '', accessory: '' }
})

export function findItem(category, id) {
  return wardrobe[category]?.find(item => item.id === id) || null
}

export function categoryForBottom(id) {
  return id?.startsWith('skirts-') ? 'skirts'
    : id?.startsWith('shorts-') ? 'shorts' : null
}

// Normalize server data so old saved shoes never appear in the UI or API payload.
export function normalizeAppearance(saved) {
  const defaults = defaultAppearance()
  const base = wardrobe.bases.find(item => item.id === saved?.baseId && !item.comingSoon)
  const equipped = saved?.equipped || {}
  return {
    baseId: base?.id || defaults.baseId,
    equipped: {
      dress: equipped.dress || '',
      top: equipped.top || '',
      bottom: equipped.bottom || '',
      accessory: equipped.accessory || ''
    }
  }
}

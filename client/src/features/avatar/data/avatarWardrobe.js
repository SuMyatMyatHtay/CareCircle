
export const categories = [
  { id: 'bases', label: 'Characters', icon: 'bi-person-hearts' },
  { id: 'dresses', label: 'Dresses', icon: 'bi-heart' },
  { id: 'tops', label: 'Tops', icon: 'bi-stars' },
  { id: 'skirts', label: 'Skirts', icon: 'bi-flower1' },
  { id: 'shorts', label: 'Shorts', icon: 'bi-grid' },
  { id: 'shoes', label: 'Shoes', icon: 'bi-bag' },
  { id: 'accessories', label: 'Accessories', icon: 'bi-gem' }
]

// All available characters
const bases = [
  'cat',
  'dog',
  'fox',
  'elephant',
  'dinosaur',
  'rabbit',
  'chick',
  'duck'
]

// Characters that cannot be selected yet
export const lockedBases = ['rabbit', 'chick', 'duck']

export const wardrobe = {
  bases: bases.map(name => ({
    id: name,
    name: name[0].toUpperCase() + name.slice(1),
    image: `/avatars/bases/${name}.png`,

    // Lock Rabbit and Chick
    comingSoon: lockedBases.includes(name)
  })),

  ...Object.fromEntries(
    ['dresses', 'tops', 'skirts', 'shorts', 'shoes', 'accessories'].map(
      category => [
        category,
        Array.from({ length: 12 }, (_, i) => ({
          id: `${category}-${String(i + 1).padStart(2, '0')}`,

          name: `${
            category === 'accessories' ? 'Accessory'
            : category === 'shoes' ? 'Shoes'
            : category === 'shorts' ? 'Shorts'
            : category === 'skirts' ? 'Skirt'
            : category === 'dresses' ? 'Dress'
            : 'Top'
          } ${i + 1}`,

          image: `/avatars/${category}/${category}-${String(i + 1).padStart(2, '0')}.png`
        }))
      ]
    )
  )
}

export const defaultAppearance = () => ({
  baseId: 'cat',
  equipped: {
    dress: '',
    top: '',
    bottom: '',
    shoes: '',
    accessory: ''
  }
})

export function findItem(category, id) {
  return wardrobe[category]?.find(item => item.id === id) || null
}

export function categoryForBottom(id) {
  return id?.startsWith('skirts-')
    ? 'skirts'
    : id?.startsWith('shorts-')
      ? 'shorts'
      : null
}

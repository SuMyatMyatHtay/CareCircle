export const categories = [
  { id: 'bases', label: 'Avatar', icon: 'bi-person-standing' },
  { id: 'tops', label: 'Tops', icon: 'bi-bag-heart' },
  { id: 'bottoms', label: 'Bottoms', icon: 'bi-grid' },
  { id: 'shoes', label: 'Shoes', icon: 'bi-stars' },
  { id: 'accessories', label: 'Accessories', icon: 'bi-gem' }
]

// Place SAME-SIZE transparent PNGs in client/public/avatars/<category>/.
// These are starter asset IDs; PNG files are not included because your reference
// image shows fully dressed figures, not separate transparent clothing pieces.
export const wardrobe = {
  bases: [
    { id: 'base-01', name: 'Classic', image: '/avatars/bases/base-01.png' },
    { id: 'base-02', name: 'Soft', image: '/avatars/bases/base-02.png' }
  ],
  tops: [
    { id: 'top-01', name: 'Everyday Tee', image: '/avatars/tops/top-01.png' },
    { id: 'top-02', name: 'Pink Outfit', image: '/avatars/tops/top-02.png' }
  ],
  bottoms: [
    { id: 'bottom-01', name: 'Casual Skirt', image: '/avatars/bottoms/bottom-01.png' },
    { id: 'bottom-02', name: 'Denim Shorts', image: '/avatars/bottoms/bottom-02.png' }
  ],
  shoes: [
    { id: 'shoes-01', name: 'White Sneakers', image: '/avatars/shoes/shoes-01.png' },
    { id: 'shoes-02', name: 'Pink Shoes', image: '/avatars/shoes/shoes-02.png' }
  ],
  accessories: [
    { id: 'accessory-01', name: 'Cute Bag', image: '/avatars/accessories/accessory-01.png' }
  ]
}
export const defaultAppearance = () => ({
  baseId: 'base-01',
  equipped: { top: '', bottom: '', shoes: '', accessory: '' }
})
export function findItem(category, id) {
  return wardrobe[category]?.find(item => item.id === id) || null
}

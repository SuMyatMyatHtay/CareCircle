import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { validProfilePicture } from '../../server/src/utils/profilePicture.js'
import { defaultProfilePicture, profilePictures } from '../../client/src/components/common/profilePictures.js'

test('all care types and family members have an existing default image', () => {
  for (const careType of [undefined, 'elderly', 'pregnancy', 'postpartum', 'infant', 'injury', 'other']) {
    assert.ok(existsSync(new URL('../../client/public' + defaultProfilePicture({ careType }), import.meta.url)))
  }
  assert.notEqual(defaultProfilePicture({ careType: 'infant' }), defaultProfilePicture({ careType: 'elderly' }))
})
test('picture input accepts presets, reset, and bounded JPEG uploads only', () => {
  assert.ok(validProfilePicture(''))
  for (const picture of profilePictures) assert.ok(validProfilePicture(picture.src))
  assert.ok(validProfilePicture('data:image/jpeg;base64,/9j/AAAA'))
  for (const value of [null, {}, 1, 'https://example.com/photo.jpg', '/avatars/people/../../secret', 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,' + 'A'.repeat(50000)]) {
    assert.equal(validProfilePicture(value), false)
  }
})

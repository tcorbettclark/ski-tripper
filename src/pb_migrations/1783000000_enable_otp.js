/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.otp.enabled = true

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.otp.enabled = false

    app.save(users)
  }
)

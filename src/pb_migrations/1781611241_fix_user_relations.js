/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    var usersCollectionId = '_pb_users_auth_'
    var collections = [
      { name: 'preferences', field: 'user' },
      { name: 'participants', field: 'user' },
      { name: 'proposals', field: 'proposer' },
      { name: 'polls', field: 'creator' },
      { name: 'votes', field: 'voter' },
      { name: 'discussion', field: 'author' },
    ]
    var i, item, collection, field

    for (i = 0; i < collections.length; i++) {
      item = collections[i]
      collection = app.findCollectionByNameOrId(item.name)
      field = collection.fields.getByName(item.field)
      field.collectionId = usersCollectionId
      app.saveNoValidate(collection)
    }
  },
  (app) => {
    var superusersCollectionId = 'pbc_3142635823'
    var collections = [
      { name: 'preferences', field: 'user' },
      { name: 'participants', field: 'user' },
      { name: 'proposals', field: 'proposer' },
      { name: 'polls', field: 'creator' },
      { name: 'votes', field: 'voter' },
      { name: 'discussion', field: 'author' },
    ]
    var i, item, collection, field

    for (i = 0; i < collections.length; i++) {
      item = collections[i]
      collection = app.findCollectionByNameOrId(item.name)
      field = collection.fields.getByName(item.field)
      field.collectionId = superusersCollectionId
      app.saveNoValidate(collection)
    }
  }
)

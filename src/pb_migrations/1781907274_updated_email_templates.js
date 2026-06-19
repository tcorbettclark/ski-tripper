/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users) {
      users.verificationTemplate = {
        body: '<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/verify?token={TOKEN}" target="_blank" rel="noopener">Verify</a>\n</p>\n<p><i>If you didn\'t recently register, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
        subject: 'Verify your {APP_NAME} email',
      }

      users.resetPasswordTemplate = {
        body: '<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class="btn" href="{APP_URL}/reset-password?token={TOKEN}" target="_blank" rel="noopener">Reset password</a>\n</p>\n<p><i>If you didn\'t ask to reset your password, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
        subject: 'Reset your {APP_NAME} password',
      }

      app.save(users)
    }

    const snapshots = app.findCollectionByNameOrId('snapshots')
    if (snapshots) {
      snapshots.confirmEmailChangeTemplate = {
        body: '<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/confirm-email?token={TOKEN}" target="_blank" rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn\'t ask to change your email address, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
        subject: 'Confirm your {APP_NAME} new email address',
      }

      app.save(snapshots)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users) {
      users.verificationTemplate = {
        body: '<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Verify</a>\n</p>\n<p><i>If you didn\'t recently register, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
        subject: 'Verify your {APP_NAME} email',
      }

      users.resetPasswordTemplate = {
        body: '<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a>\n</p>\n<p><i>If you didn\'t ask to reset your password, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
        subject: 'Reset your {APP_NAME} password',
      }

      app.save(users)
    }

    const snapshots = app.findCollectionByNameOrId('snapshots')
    if (snapshots) {
      snapshots.confirmEmailChangeTemplate = {
        body: '<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn\'t ask to change your email address, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
        subject: 'Confirm your {APP_NAME} new email address',
      }

      app.save(snapshots)
    }
  }
)

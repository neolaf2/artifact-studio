'use strict';
const vscode = require('vscode');

/**
 * Thin entry: run the Overleaf extension activate, then register
 * Artifact Studio: Open Project / New Project.
 */
const core = require('./extension');

function activate(context) {
  core.activate(context);
  function register(name, handler) {
    context.subscriptions.push(
      vscode.commands.registerCommand('artifactStudio.' + name, async function () {
        try {
          return await handler.apply(null, arguments);
        } catch (error) {
          vscode.window.showErrorMessage(error.message);
          return undefined;
        }
      })
    );
  }
  require('./projects').registerProjectCommands(context, {
    register: register,
    changed: { fire: function () {} }
  });
}

module.exports = { activate: activate };

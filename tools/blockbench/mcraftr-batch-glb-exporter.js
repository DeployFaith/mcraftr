(function () {
  const PLUGIN_ID = 'mcraftr_batch_glb_exporter'
  const PLUGIN_TITLE = 'Mcraftr Batch GLB Exporter'
  let batchExportAction = null

  function ensureDesktop() {
    if (typeof isApp !== 'undefined' && !isApp) {
      Blockbench.showQuickMessage('Batch GLB export is only available in the desktop Blockbench app.', 3000)
      return false
    }
    return true
  }

  function getNodeModules() {
    const fs = require('fs')
    const path = require('path')
    const electron = require('electron')
    return { fs, path, electron }
  }

  async function pickDirectory(title, defaultPath) {
    const { electron } = getNodeModules()
    const dialog = electron.remote?.dialog ?? electron.dialog
    const result = await dialog.showOpenDialog({
      title,
      defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths?.[0]) return null
    return result.filePaths[0]
  }

  function safeParseSettings(raw) {
    try {
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  function loadSettings() {
    return safeParseSettings(localStorage.getItem(`${PLUGIN_ID}:settings`))
  }

  function saveSettings(settings) {
    localStorage.setItem(`${PLUGIN_ID}:settings`, JSON.stringify(settings))
  }

  function listBBModels(inputDir) {
    const { fs, path } = getNodeModules()
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      return entries.flatMap(entry => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) return walk(full)
        return entry.name.toLowerCase().endsWith('.bbmodel') ? [full] : []
      })
    }
    return walk(inputDir)
  }

  function inferBucket(filePath) {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase()
    if (normalized.includes('/entity') || normalized.includes('/entities/')) return 'entities'
    if (normalized.includes('/structure') || normalized.includes('/structures/')) return 'structures'
    return 'items'
  }

  function relativeModelId(inputDir, filePath) {
    const { path } = getNodeModules()
    const relative = path.relative(inputDir, filePath).replace(/\\/g, '/')
    return relative.replace(/\.bbmodel$/i, '').replace(/\s+/g, '_').toLowerCase()
  }

  function outputFileFor(inputDir, outputDir, filePath, format) {
    const { path, fs } = getNodeModules()
    const bucket = inferBucket(filePath)
    const modelId = relativeModelId(inputDir, filePath)
    const fileName = `${path.basename(modelId)}.${format}`
    const finalDir = path.join(outputDir, bucket)
    if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true })
    return path.join(finalDir, fileName)
  }

  async function openModel(filePath) {
    return new Promise((resolve, reject) => {
      Blockbench.read([filePath], {}, files => {
        try {
          const file = files?.[0]
          if (!file?.content) throw new Error(`Unable to read ${filePath}`)
          Codecs.project.load(file.content, { path: filePath })
          resolve(true)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  async function exportCurrentModel(targetPath, includeAnimations) {
    const codec = Codecs.gltf
    if (!codec) throw new Error('Blockbench glTF codec is unavailable in this build.')

    const exportOptions = {
      format: 'glb',
      embed_textures: true,
      include_animations: includeAnimations,
      scale: 1,
    }

    return new Promise((resolve, reject) => {
      codec.export(exportOptions, exported => {
        try {
          const { fs } = getNodeModules()
          if (!exported) throw new Error('glTF export returned no data')
          if (exported instanceof ArrayBuffer) {
            fs.writeFileSync(targetPath, Buffer.from(exported))
          } else if (typeof exported === 'string') {
            fs.writeFileSync(targetPath, exported, 'utf8')
          } else if (exported.content instanceof ArrayBuffer) {
            fs.writeFileSync(targetPath, Buffer.from(exported.content))
          } else {
            throw new Error('Unsupported glTF export payload type')
          }
          resolve(true)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  async function runBatchExport() {
    if (!ensureDesktop()) return
    const settings = loadSettings()
    const inputDir = await pickDirectory('Select folder with .bbmodel files', settings.inputDir)
    if (!inputDir) return
    const outputDir = await pickDirectory('Select output folder (e.g. public/models)', settings.outputDir)
    if (!outputDir) return

    saveSettings({ inputDir, outputDir })

    const files = listBBModels(inputDir)
    if (files.length === 0) {
      Blockbench.showMessageBox({ title: PLUGIN_TITLE, message: 'No .bbmodel files were found in the selected input folder.' })
      return
    }

    const includeAnimations = await new Promise(resolve => {
      new Dialog({
        id: `${PLUGIN_ID}_options`,
        title: PLUGIN_TITLE,
        form: {
          includeAnimations: {
            label: 'Include animations',
            type: 'checkbox',
            value: true,
          },
        },
        onConfirm(formResult) {
          resolve(Boolean(formResult.includeAnimations))
          this.hide()
        },
        onCancel() {
          resolve(true)
          this.hide()
        },
      }).show()
    })

    let completed = 0
    const failures = []
    Blockbench.showQuickMessage(`Starting export of ${files.length} models…`, 3000)

    for (const filePath of files) {
      try {
        await openModel(filePath)
        const targetPath = outputFileFor(inputDir, outputDir, filePath, 'glb')
        await exportCurrentModel(targetPath, includeAnimations)
        completed += 1
        Blockbench.setStatusBarText(`Exported ${completed}/${files.length}: ${targetPath}`)
      } catch (error) {
        failures.push({ filePath, error: error instanceof Error ? error.message : String(error) })
      }
    }

    const summary = [
      `Exported ${completed} of ${files.length} models.`,
      failures.length > 0 ? `Failures: ${failures.length}` : 'All exports succeeded.',
    ].join('\n')

    Blockbench.showMessageBox({
      title: PLUGIN_TITLE,
      message: summary,
      icon: failures.length > 0 ? 'warning' : 'info',
    })

    if (failures.length > 0) {
      console.error(`[${PLUGIN_TITLE}] export failures`, failures)
    }
  }

  Plugin.register(PLUGIN_ID, {
    title: PLUGIN_TITLE,
    author: 'Hermes Agent',
    icon: 'view_in_ar',
    description: 'Batch export Blockbench .bbmodel files to GLB files for mcraftr item/entity/structure previews.',
    version: '1.0.0',
    variant: 'desktop',
    onload() {
      batchExportAction = new Action(`${PLUGIN_ID}_run`, {
        name: 'Batch Export .bbmodel Folder to GLB',
        icon: 'view_in_ar',
        click: () => void runBatchExport(),
      })
      MenuBar.addAction(batchExportAction, 'tools')
    },
    onunload() {
      if (batchExportAction) batchExportAction.delete()
    },
  })
})()

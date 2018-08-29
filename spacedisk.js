// 
// SpaceDisk
// Show disk usage in menu bar
//

// Do not save store on update
// change icon/title only if needed

const { app, shell, Menu, Tray, BrowserWindow, Notification, dialog } = require('electron')
const diskspace = require('diskspace')
const emptyTrash = require('empty-trash')
const Store = require('electron-store')
const AutoLaunch = require('auto-launch')
const package_info = require(__dirname + '/package.json')
const i18n = require('i18n')
const __ = i18n.__

let tray = null
let info = null
let menu = null
let store = new Store()
let theme = store.get('theme', 'default')
let launcher = new AutoLaunch({ name: app.getName() })

function onReady() {
  
  const _interval = 5000
  const _locales = __dirname + '/locales'
  
  i18n.configure({
    defaultLocale: 'en',//app.getLocale(),
    directory: _locales
  })
  
  getDisk((diskinfo) => {
    info = diskinfo
    tray = new Tray(formatIcon(info))
    menu = Menu.buildFromTemplate([
      { label: __('Total: %s', formatFileSize(info.total)), enabled: false },
      { type: 'separator' },
      { label: __('Free'), type: 'radio', click: onRender, checked: store.get('show_available', true) },
      { label: __('Used'), type: 'radio', click: onRender, checked: ! store.get('show_available', true) },
      { type: 'separator' },
      { label: __('Show percentage'), type: 'checkbox', click: onRender, checked: store.get('show_percentage', false) },
      { type: 'separator' },
      { label: __('Launch on startup'), type:'checkbox', click: onToggleAutostart, checked: store.get('autostart', false) },
      { type: 'separator' },
      { label: __('Empty trash'), click: onTrash },
      { type: 'separator' },
      { label: __('About %s', app.getName()), role: 'about' },
      { label: __('Home page'), click: onHomepage },
      //{ label: __('Check for updates'), click: onUpgrade },
      { label: __('Quit'), click: app.quit },
    ])
    tray.setContextMenu(menu)
    onRender()
  })
  
  setInterval(() => {
    getDisk((diskinfo) => {
      info = diskinfo
      onRender()
    })
  }, _interval)

}

function getState() {
  return {
    'show_available': menu.items[2].checked,
    'show_percentage': menu.items[5].checked,
    'autostart' : menu.items[7].checked
  }
}

function storeState(state) {
  store.set('show_available', state.show_available)
  store.set('show_percentage', state.show_percentage)
  store.set('autostart', state.autostart)
}

function onRender(fromMenu) {
  let state = getState()  
  let title = formatDiskInfo(info, state.show_available, state.show_percentage)
  let icon = formatIcon(info, state.show_available)
  tray.setTitle(title)
  tray.setToolTip(title)
  tray.setImage(icon)
  if(fromMenu) {
    storeState(state)
  }
}

function onToggleAutostart(item) {
  let autostart = item.checked
  if(autostart) {
    launcher.enable()
  } else {
    launcher.disable()
  }
  store.set('autostart', autostart)
}

function onTrash() {
  var oldinfo = info
  emptyTrash().then(() => {
    getDisk((diskinfo) => {
      info = diskinfo
      let saved = formatFileSize(Math.max(0, info.free - oldinfo.free))
      new Notification({
        title: __('Emptied trash'),
        body: __('Saved %s', saved),
        silent: true
      }).show()
      onRender()
    })
  })
}

function onHomepage() {
  const _homepage = package_info.homepage
  if(_homepage) {
    shell.openExternal(_homepage)
  } else {
    console.log('%s error', 'No Homepage')
  }
}

function onUpgrade() {
  dialog.showMessageBox({
   type: "info",
   message: __('No updates found'),
  })
}

function onUncaughtException(error) {
  console.log(error)
  dialog.showMessageBox({
    type: "error",
    message: __('%s error', app.getName()),
    detail: __("Please check %s install", app.getName()),
  }, app.quit)
}

function formatIcon(disk_info, show_available) {
  let _assets = __dirname + '/themes/' + theme
  let total = disk_info.total
  let value = disk_info.used
  if(show_available) {
    value = disk_info.free
  } 
  let val = parseInt( value * 10 / total )
  let icon = 'level' + val + 'Template.png'
  return _assets + '/' + icon 
}

function formatDiskInfo(diskspace, show_available, show_percentage) {
  if(show_available) {
    value = diskspace.free
  } else {
    value = diskspace.used 
  }
  if(show_percentage) {
    value = parseInt( value * 100 / diskspace.total ) + " %"
  } else {
    value = formatFileSize(value)
  }
  return value
}

function formatFileSize(filesize) {
  const _units = ['B', 'kB', 'MB', 'GB', 'TB']
  const _precision = 2
  const _kilo = 1000
  if(filesize <= 0) {
    return '0 ' + __(_units[1])
  }
  let i = Math.floor( Math.log(filesize) / Math.log(_kilo) )
  return ( filesize / Math.pow(_kilo, i) ).toFixed(_precision) * 1 + ' ' + __(_units[i])
}

function getDisk(callback) {
  let drive = '/'
  if(process.platform === 'win32') {
    drive = 'C'
  }
  diskspace.check(drive, (err, result) => {
    callback(result)
  })
}

//
// Init app
//

if(process.platform === 'darwin') {
  app.dock.hide() // Hide dock icon on macOS
}

app.on('ready', onReady) // Init app

process.on('uncaughtException', onUncaughtException) // fail gracefully

console.log(app.getName() + ' v'+ package_info.version) // print version

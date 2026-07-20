// @workspace shared
import ai from './ai'
import changelog from './changelog'
import chrome from './chrome'
import coach from './coach'
import common from './common'
import dialog from './dialog'
import editor from './editor'
import ideaBoard from './ideaBoard'
import landing from './landing'
import reading from './reading'
import store from './store'
import upload from './upload'

export default {
  ...common,
  ...changelog,
  ...chrome,
  ...dialog,
  ...editor,
  ...reading,
  ...ideaBoard,
  ...landing,
  ...coach,
  ai,
  upload,
  store,
}

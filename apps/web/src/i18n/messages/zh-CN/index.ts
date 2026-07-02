import ai from './ai'
import chrome from './chrome'
import common from './common'
import dialog from './dialog'
import editor from './editor'
import ideaBoard from './ideaBoard'
import reading from './reading'
import store from './store'
import upload from './upload'

export default {
  ...common,
  ...chrome,
  ...dialog,
  ...editor,
  ...reading,
  ...ideaBoard,
  ai,
  upload,
  store,
}

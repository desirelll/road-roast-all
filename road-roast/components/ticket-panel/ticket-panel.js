Component({
  properties: {
    road: {
      type: Object,
      value: null
    },
    posting: {
      type: Boolean,
      value: false
    }
  },

  data: {
    comment: '',
    keyboardHeight: 0
  },

  lifetimes: {
    attached() {
      this._keyboardHandler = (res) => {
        this.setData({ keyboardHeight: res.height })
      }
      wx.onKeyboardHeightChange(this._keyboardHandler)
    },
    detached() {
      if (this._keyboardHandler) {
        wx.offKeyboardHeightChange(this._keyboardHandler)
      }
    }
  },

  methods: {
    onCommentInput(e) {
      this.setData({ comment: e.detail.value })
    },

    onPost() {
      if (this.data.posting) return
      const { comment } = this.data
      if (comment.length > 50) {
        wx.showToast({ title: '最多50个字', icon: 'none' })
        return
      }
      this.triggerEvent('post', { comment })
    },

    onPanelTap() {
      this._inside = true
    },

    onOverlayTap() {
      if (this._inside) {
        this._inside = false
        return
      }
      this.triggerEvent('close')
    }
  }
})

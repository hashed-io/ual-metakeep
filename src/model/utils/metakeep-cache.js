// utils/metakeep-cache.js

class MetakeepCache {
  constructor () {
    this.cache = {}
    this.logged = null
    this.mails = []
    this.loadCache()
  }

  loadCache () {
    try {
      const cachedData = window.localStorage.getItem('metakeep.data')
      if (cachedData) {
        this.cache = JSON.parse(cachedData)
      }
      this.logged = window.localStorage.getItem('metakeep.logged')
      this.mails = Object.keys(this.cache)
    } catch (error) {
      console.error('Error loading Metakeep cache:', error)
    }
  }

  saveCache () {
    try {
      window.localStorage.setItem('metakeep.data', JSON.stringify(this.cache))
      if (this.logged) {
        window.localStorage.setItem('metakeep.logged', this.logged)
      } else {
        window.localStorage.removeItem('metakeep.logged')
      }
    } catch (error) {
      console.error('Error saving Metakeep cache:', error)
    }
  }

  assertCache (email, chainId) {
    console.log('assertCache', { email, chainId })
    if (!this.cache[email]) {
      this.cache[email] = {
        wallet: {
          eosAddress: '',
          solAddress: '',
          ethAddress: ''
        },
        chains: {}
      }
    }
    if (chainId) {
      try {
        if (!this.cache[email][chainId]) {
          this.cache[email][chainId] = {
            accounts: []
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  getMails () {
    return Object.keys(this.cache)
  }

  getEosAddress (email) {
    this.assertCache(email)
    return this.cache[email]?.wallet?.eosAddress ?? ''
  }

  getSolAddress (email) {
    this.assertCache(email)
    return this.cache[email]?.wallet?.solAddress ?? ''
  }

  getEthAddress (email) {
    this.assertCache(email)
    return this.cache[email]?.wallet?.ethAddress ?? ''
  }

  getAccountNames (email, chainId) {
    this.assertCache(email, chainId)
    console.log('getAccountNames', this.cache, { email, chainId })
    return this.cache[email]?.[chainId]?.accounts ?? []
  }

  getLogged () {
    return this.logged
  }

  // setters --------------
  addAccountName (email, chainId, accountName) {
    this.assertCache(email, chainId)
    if (!this.cache[email][chainId].accounts.includes(accountName)) {
      this.cache[email][chainId].accounts.push(accountName)
    }
    this.saveCache()
  }

  addCredentials (email, wallet) {
    this.assertCache(email)
    this.cache[email].wallet = wallet
    this.saveCache()
  }

  setLogged (email) {
    if (email) {
      this.assertCache(email)
    }
    this.logged = email
    this.saveCache()
  }
}

export const metakeepCache = new MetakeepCache()

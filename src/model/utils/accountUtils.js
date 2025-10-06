/* eslint-disable */
const axios = require('axios')

/**
 * Get accounts by public key with retry behavior across multiple endpoints
 * @param {string} publicKey - The public key to search for
 * @param {string[]} readEndpoints - Array of endpoint URLs to try
 * @param {number} maxRetries - Maximum number of retries per endpoint (default: 3)
 * @param {number} timeout - Request timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} - Response containing account information
 */
async function getAccountsByKeys (publicKey, readEndpoints, maxRetries = 3, timeout = 2500) {
  if (!publicKey) {
    throw new Error('publicKey is required')
  }

  if (!readEndpoints || !Array.isArray(readEndpoints) || readEndpoints.length === 0) {
    throw new Error('readEndpoints must be a non-empty array')
  }

  const requestBody = {
    accounts: [],
    keys: [publicKey]
  }

  let lastError = null

  // Try each endpoint with retry behavior
  for (const endpoint of readEndpoints) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `${endpoint.replace(/\/$/, '')}/v1/chain/get_accounts_by_authorizers`
        
        console.log(`Attempting request to ${url} (attempt ${attempt}/${maxRetries})`)
        
        const response = await axios.post(url, requestBody, {
          timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (response.data) {
          console.log(`Successfully retrieved accounts from ${endpoint}`)
          return response.data
        }
      } catch (error) {
        lastError = error
        console.warn(`Request to ${endpoint} failed (attempt ${attempt}/${maxRetries}):`, 
          error.message || error)

        // If this is not the last attempt for this endpoint, wait before retrying
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff with max 5s
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
  }

  // If we get here, all endpoints failed
  throw new Error(`Failed to retrieve accounts from all endpoints. Last error: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Get unique account names for a given public key
 * @param {string} publicKey - The public key to search for
 * @param {string[]} readEndpoints - Array of endpoint URLs to try
 * @param {number} maxRetries - Maximum number of retries per endpoint (default: 3)
 * @param {number} timeout - Request timeout in milliseconds (default: 2500)
 * @returns {Promise<string[]>} - Array of unique account names
 */
function getUniqueAccountNames (accountsByKeys) {
  try {
    // Extract account names from the response
    const accountNames = []
    
    if (accountsByKeys) {
      // Handle accounts array format
      accountsByKeys.forEach(account => {
        if (account.account_name) {
          accountNames.push(account.account_name)
        }
      })
    }
    
    // Remove duplicates and return unique account names
    return [...new Set(accountNames)]
  } catch (error) {
    console.error('Error getting unique account names:', error.message)
    throw error
  }
}

module.exports = {
  getAccountsByKeys,
  getUniqueAccountNames
}
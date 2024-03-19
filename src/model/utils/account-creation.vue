<template>
<div>
  <div class="cModal" v-if="showModal == true">
    <div class="cModal-content">
        <p class="cTitle" v-if="isLoading == false">TLOS Account creation</p>
        <div v-if="isLoading == false">
          <label for="accountName" class="label">Telos account name</label>
          <br>
          <input
            v-model="telosAccountName"
            id="accountName"
            :class="inputAccountNameClass"
            autocomplete="off"
            @input="toLowerCase"
          >
          <br/>
          <p class="cErrorLabel" v-if="errorMessage"> {{ errorMessage }}</p>
          <p class="cErrorLabel" v-if="!isValidAccountName && telosAccountName">The Telos account must consist of exactly 12 characters, which can include lowercase letters from 'a' to 'z' and numbers from '0' to '9'. No spaces or special characters are allowed.</p>
          <br>
          <div class="cButtonsContainer">
            <button class="cButton cancelButton" @click="closeModal">Cancel</button>
            <button
                :class="['cButton', 'approveButton', { 'disabled': !isValidAccountName }]"
                @click="createAccount"
            >Create account</button>
          </div>
       
        </div>
        <div v-else class="cCenter-container">
          <div>
            <div class="cRow ">
              <div class="cCenter-container">
                <p>Wait a moment</p>
              </div>
            </div>
            <div class="cRow">
              <div class="cCenter-container">
                <div class="cSpinner "></div>
              </div>
            </div>
          </div>
        </div>

  </div>
</div>
</div>
</template>

<script setup>
import { onMounted, ref, defineProps, computed } from 'vue'
const props = defineProps(['onCancel', 'onCreateAccount', 'executeRecaptchaRequest', 'publicKey', 'apiURL'])

const showModal = ref(false)
const isLoading = ref(false)
const telosAccountName = ref(undefined)
const errorMessage = ref(undefined)
const recaptchaToken = ref(undefined)

const apiURL = props.apiURL

onMounted(() => {
    showModal.value = true
})

const toLowerCase = () => {
  telosAccountName.value = telosAccountName.value.toLowerCase();
}

const inputAccountNameClass = computed(() => {
    if (telosAccountName.value === undefined) {
        return 'cInput'
    }

    const isValidFormat = /^([a-z]|[1-5]|[.]){12}$/.test(telosAccountName.value.toLowerCase())
    const inputClass = isValidFormat ? 'cInput' : 'cInput cInput-invalid'
    return inputClass
})

const isValidAccountName = computed(() => {
  if (!telosAccountName.value) return false
  const isValidFormat = /^([a-z]|[1-5]|[.]){12}$/.test(telosAccountName.value.toLowerCase())
  return isValidFormat
})

const closeModal = () => {
    showModal.value = false
    props.onCancel()
}

async function createAccount () {
    try {
      if (!isValidAccountName.value) return

        const isValidAccount = await validateAccountName() === true
        if (isValidAccount) {
            isLoading.value = true
            recaptchaToken.value = await props.executeRecaptchaRequest()

            const endpointURL = `${apiURL}/recaptchaCreate`

            const response = await fetch(endpointURL, {
                method: 'POST',
                headers: {
                    "Content-Type": 'application/json'
                },
                body: JSON.stringify(
                    {
                        recaptchaResponse: recaptchaToken.value,
                        accountName: telosAccountName.value,
                        ownerKey: props.publicKey,
                        activeKey: props.publicKey
                    }
                )

            })

            if (response.status === 400 || response.status === 500 || response.status === 403) {
                const reader = response.body.getReader();
                const responseBody = await reader.read();
                errorMessage.value = new TextDecoder().decode(responseBody.value);
                isLoading.value = false
                return false
            }

            // props.onCreateAccount(telosAccountName.value)
            showModal.value = false
        }
    } catch {
        errorMessage.value = e.message || e
        isLoading.value = false
    }

}

async function validateAccountName () {
    try {
        errorMessage.value = undefined
        const endpointURL = `${apiURL}/accounts/${telosAccountName.value}`
        isLoading.value = true
        const response = await fetch(endpointURL, {
            headers: {
                "Content-Type": "application/json"
            }
        })
        if (response.status === 400) {
            const reader = response.body.getReader();
            const responseBody = await reader.read();
            errorMessage.value = new TextDecoder().decode(responseBody.value);
            return false
        }
        return true
    } catch (e) {
        errorMessage.value = e.message || e
    } finally {
        isLoading.value = false
    }
    return false
}
</script>

<style>
.cErrorLabel {
  color: #f44336;
  padding: 0px;
  margin: 0px;
}

.cInput {
  padding: 15px;
  width: 100%;
  border-radius: 8px;
  background-color: #f2f2f2;
  border: 1px solid #ccc;
  outline: none;
  transition: border-color 0.3s ease;
}

.cInput:focus {
  border-color: #2196F3; /* Cambia el color del borde al enfocar */
}

.cInput-invalid {
  border: 1px solid #f44336;
}

.cInput-invalid:focus{
  border: 1px solid #f44336;
}

.cButtonsContainer {
  display: flex;
  justify-content: space-between; /* Cambiado a space-between para distribuir uniformemente */
  margin-top: 0px; /* Agregado margen superior */
}

.cLabel {
  color: #666; /* Cambiado a un tono más oscuro */
}

.cTitle {
  color: #333; /* Cambiado a un tono más oscuro */
  font-size: 1.2rem; /* Aumentado el tamaño de fuente */
  margin-top: 0px; /* Agregado margen inferior */
  margin-bottom: 10px; /* Agregado margen inferior */
}

.approveButton, .cancelButton {
  padding: 12px 20px; /* Ajuste del tamaño de los botones */
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease, color 0.3s ease; /* Transición suave */
}

.approveButton {
  background-color: #4CAF50; /* Color verde */
  color: white;
}

.approveButton:hover {
  background-color: #45a049; /* Color verde oscuro al pasar el ratón */
}

.cancelButton {
  background-color: #f44336; /* Color rojo */
  color: white;
}

.cancelButton:hover {
  background-color: #d32f2f; /* Color rojo oscuro al pasar el ratón */
}

.cButton {
  width: 48%; /* Ligeramente reducido el ancho para ajustar mejor */
}

.cModal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.cModal-content {
  background-color: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Sombra suave */
  width: 400px;
}

.cSpinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #333;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.cCenter-container {
    width: 100%;
    display: flex;
    justify-content: center;
}

.c_row {
  display: flex; /* Hace que los elementos hijos se alineen en una fila */
  flex-wrap: wrap; /* Permite que los elementos hijos se envuelvan a la siguiente línea si no hay suficiente espacio */
  margin-right: -15px; /* Corrige el margen derecho negativo generado por el uso de flexbox */
  margin-left: -15px; /* Corrige el margen izquierdo negativo generado por el uso de flexbox */
}

</style>

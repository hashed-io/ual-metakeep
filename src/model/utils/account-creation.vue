<template>
<div>
  <div class="cModal" v-if="showModal == true">
    <div class="cModal-content">
        <p class="cTitle" v-if="isLoading == false">Account creation</p>
        <div v-if="isLoading == false">
          <label for="accountName" class="label">Telos account</label>
          <br>
          <input v-model="telosAccountName" id="accountName" class="cInput" autocomplete="off">
          <br/>
          <p class="cErrorLabel" v-if="errorMessage"> {{ errorMessage }}</p>
          <br>
          <div class="cButtonsContainer">
            <button class="cButton cancelButton" @click="closeModal">Cancel</button>
            <button
                class="cButton approveButton"
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

const props = defineProps(['onCancel', 'onCreateAccount'])

const showModal = ref(false)
const isLoading = ref(false)
const telosAccountName = ref(undefined)
const errorMessage = ref(undefined)



onMounted(() => {
    showModal.value = true
})

const isCreateButtonDisabled = computed(() => {
    return telosAccountName.value?.length === 0
})

const closeModal = () => {
    showModal.value = false
    props.onCancel()
}

async function createAccount () {
    if (await validateAccountName() === true) {
        props.onCreateAccount(telosAccountName.value)
    }
}

const apiURL = "https://telos-account-creator-test-c1d9d1af38a4.herokuapp.com/v1"

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
  width: 94%;
  border-radius: 8px;
  background-color: #f2f2f2;
  border: 1px solid #ccc;
  outline: none;
  transition: border-color 0.3s ease;
}

.cInput:focus {
  border-color: #2196F3; /* Cambia el color del borde al enfocar */
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
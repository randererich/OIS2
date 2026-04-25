import { defineStore } from "pinia";

export const usePosStore = defineStore("pos", {
  state: () => ({
    product: null,
    quantity: 1,
    person: null,
    comment: ""
  }),
  getters: {
    total: (state) => {
      if (!state.product) {
        return 0;
      }
      return Number(state.product.price) * Number(state.quantity || 0);
    }
  },
  actions: {
    selectProduct(product) {
      this.product = product;
      this.quantity = 1;
      this.person = null;
      this.comment = "";
    },
    setQuantity(quantity) {
      this.quantity = quantity;
    },
    selectPerson(person) {
      this.person = person;
    },
    reset() {
      this.product = null;
      this.quantity = 1;
      this.person = null;
      this.comment = "";
    }
  }
});

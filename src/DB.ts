import mongoose, { Schema } from "mongoose";
  

const PayeeSchema = new Schema({
    email : {type : String, required : true, unique : true},
    id : {type : String, required : true}
});

const PayeeModel  = mongoose.model('PayeeSchema', PayeeSchema);


export default PayeeModel


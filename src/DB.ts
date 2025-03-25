import mongoose, { Schema } from "mongoose";
  

const PayeeSchema = new Schema({
    email : {type : String, required : true, unique : true},
    id : {type : String}
});

const PayeeModel  = mongoose.model('PayeeSchema', PayeeSchema);


export default PayeeModel;

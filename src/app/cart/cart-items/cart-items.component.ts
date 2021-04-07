import { Component, ElementRef, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { BusinessService } from 'src/app/business/business.service';
import { Adicionais } from 'src/app/interfaces/adicionais';
import { Pedido } from 'src/app/interfaces/pedido';
import { PedidosOnline } from 'src/app/interfaces/pedidos-online';
import { User } from 'src/app/interfaces/user';
import { NotifyService } from 'src/app/notifications/notify.service';
import { ShopService } from 'src/app/shop/shop.service';
import * as Constants from '../../constants/constants'
import * as uuid from 'uuid'
import { PremiumService } from 'src/app/shop-premium/premium.service';
import { AngularFireAuth } from '@angular/fire/auth';

@Component({
  selector: 'app-cart-items',
  templateUrl: './cart-items.component.html',
  styleUrls: ['./cart-items.component.css']
})
export class CartItemsComponent implements OnInit {

  cart: Pedido[] = []
  url?: User
  total: number = 0
  desconto: number = 0
  disable = false
  logged? = ''
  loading = false
  taxa? : number = 0
  //adicionais$!: Observable<Adicionais[]>
  obs = this.fb.group({
    'observation': [''],
    'nome': ['', [Validators.required]],
    'pgt': ['', [Validators.required]],
    'delivery': ['true'],
    'endereco': [''],
    'troco': ['0'],
    'desconto': [''],
    'fone': ['', [Validators.required]]
  })
  entrega?: any = 'true'
  entregaForm: boolean = true
  pgt?: any = ''
  distancia? : number = 0

  /*sabor = this.fb.group({
    'sabores': ['']
  })*/

  sabor = this.fb.group({
    'sabores': this.fb.array([])
  })

  sabores = this.sabor.get('sabores') as FormArray

  constructor(private shopService: ShopService,
    private bs: BusinessService,
    private router: Router,
    private fb: FormBuilder,
    private notify: NotifyService,
    private premiumService: PremiumService,
    private auth: AngularFireAuth) {
    const nav = this.router.getCurrentNavigation()
    this.url = nav?.extras.state?.url




  }

  ngOnInit(): void {
    //this.adicionais$ = this.shopService.getAdicionais(this.url?.uid!)
    this.cart = this.shopService.getPedido()
    this.total = this.cart.reduce((prev, elem) => prev + elem.preco, 0)
    this.auth.authState.subscribe(user=>{
      if(user?.uid != null){
        this.obs.controls['nome'].setValue(user.displayName)
        this.obs.controls['fone'].setValue(localStorage.getItem(Constants.KEYS.FONE))
        this.logged = user.uid
      }else{
        this.obs.controls['nome'].setValue(localStorage.getItem(Constants.KEYS.NOME))
        this.logged = ''
      }
    })

    if (this.url?.receberPorWhatsapp) {
      this.obs.controls['fone'].setValue('1234')
    }

    this.cart.forEach(() => {
      this.sabores.push(this.fb.control(''))
    })

  }

  onAutocompleteSelected(result: any) {
    console.log('onAutocompleteSelected: ', result.formatted_address);
    this.obs.controls['endereco'].setValue(result.formatted_address)
    //this.total = this.total - this.taxa!
    if (this.taxa != undefined) {
      this.total -= this.taxa
    }else {
      this.taxa = 0
      this.total -= this.taxa
    }
    this.obs.controls['pgt'].reset()
    this.getDistancia(result.formatted_address)
    
  }

  getDistancia(adress: any) {
    return new google.maps.DistanceMatrixService().getDistanceMatrix({'origins': [`${this.url?.endereco}`], 'destinations': [adress], travelMode: google.maps.TravelMode.DRIVING}, (results: any) => {
        this.distancia = results.rows[0].elements[0].distance.value / 1000
        //console.log('resultados distancia (km) -- ', this.distancia)
        this.taxa = this.distancia * this.url?.taxaEntrega!
        console.log(this.taxa);

        if (this.taxa < this.url?.minTaxa!) {
          this.taxa = this.url?.minTaxa
        }
        this.total = this.total + this.taxa!
        
    });

    
}

  login(){
    this.premiumService.loginGoogle().then(user=>{
      this.auth.authState.subscribe(userData => {
        this.logged = userData?.uid
        this.obs.controls['nome'].setValue(userData?.displayName)
      }
      )
    })
  }

  loginFacebook(){
    this.premiumService.loginFacebook().then(user=>{
      this.auth.authState.subscribe(userData => {
        this.logged = userData?.uid
        this.obs.controls['nome'].setValue(userData?.displayName)
      }
      )
    })
  }


  descount() {
    if (this.obs.controls['desconto'].value.toUpperCase() == this.url?.cupom?.toUpperCase() && this.url?.cupomStatus) {
      this.notify.notifications(`Você ganhou um cupom de ${this.url?.desconto}% de deconto`)
      this.desconto = this.url.desconto as number;
      let descontoP = this.total * (this.desconto / 100)
      if (this.total > 0) {
        this.total = this.total - descontoP
      }
      this.disable = true
    } else {
      this.notify.notifications(`Este cupom não é válido`)
      this.desconto = 0;
      let descontoP = this.total * (this.desconto / 100)
      this.total = this.total - descontoP
    }
  }

  pgtType(evt: any) {
    this.pgt = evt.value
    if (evt.value != 'Dinheiro') {
      this.obs.controls['troco'].setValue('')
    }

  }

  handleDelivery(evt: any) {
    this.entrega = evt.value
    if (evt.value == 'true') {
      this.obs.controls['endereco'].setValue('')
    } else if (evt.value == 'false') {
      this.obs.controls['endereco'].setValue('retirada')
      this.taxa = 0
    }

  }

  handleName(evt: any) {
    localStorage.setItem(Constants.KEYS.NOME, evt.value)
  }

  handleFone(evt: any) {
    localStorage.setItem(Constants.KEYS.FONE, evt.value)
  }



  add(p: Pedido, i: number) {

    this.cart[i].preco = (this.cart[i].preco / this.cart[i].quantidade)

    this.cart[i].quantidade += 1

    this.cart[i].preco = this.cart[i].preco * this.cart[i].quantidade

    //console.log(this.cart[i].preco);

    this.total = this.cart.reduce((prev, elem) => prev + elem.preco, 0)
    let descontoP = this.total * (this.desconto / 100)
    this.total = (this.total - descontoP) + this.taxa!

  }

  min(p: Pedido, i: number) {

    if (this.cart[i].quantidade > 1) {
      this.cart[i].preco = (this.cart[i].preco / this.cart[i].quantidade)

      this.cart[i].quantidade -= 1

      this.cart[i].preco = this.cart[i].preco * this.cart[i].quantidade

      //console.log(this.cart[i].preco);

      this.total = this.cart.reduce((prev, elem) => prev + elem.preco, 0)
      let descontoP = this.total * (this.desconto / 100)
      this.total = (this.total - descontoP) + ( this.distancia! * this.url?.taxaEntrega!)  
      //console.log(this.total);
    }

  }

  finishCart() {

    let info = ''
    let pedidos = ''
    let entrega = ''

    if (this.entrega == 'false') {
      entrega = `*Retirar em:* ${this.url?.endereco}`
    } else {
      entrega = `*Entrega em:* ${this.obs.controls['endereco'].value}`
    }

    let selectionSabor = []
    selectionSabor = this.sabor.controls['sabores'].value

    for (let p in this.cart) {

      if (selectionSabor[p] != '') {
        selectionSabor[p] = `- *Sabor:* ${selectionSabor[p]}`
      } else {
        selectionSabor[p] = ''
      }


      pedidos += `*${this.cart[p].quantidade}* x ${this.cart[p].pedido}- *R$${this.cart[p].preco.toFixed(2)}* ${selectionSabor[p]}\n`

    }


    let trocoInfo = ""
    let taxaMsg = ""
    let txtTotal = ""
    let trocoFinal = 0
    let trocoTxt = ""

    if (this.obs.controls['pgt'].value == 'Dinheiro' && this.obs.controls['troco'].value != null) {
      trocoInfo = `${this.obs.controls['troco'].value}`
      trocoFinal = parseInt(trocoInfo)
      trocoTxt = `R$${trocoFinal.toFixed(2)}`
    }

    let txtTaxa = `Taxa de entrega: R$${this.taxa}`
    if (this.obs.controls['delivery'].value == 'true') {
      txtTotal = 'TOTAL:'
    } else {
      txtTotal = 'TOTAL:'
    }

    

    let descTxt = ''
    if (this.desconto > 0) {
      let txt = this.total * (this.desconto / 100) 
      descTxt = ` R$ ${txt.toFixed(2)}`
    } else {
      descTxt = "Sem desconto"
    }

    info = `${this.url?.nome} - *PEDIDO FINALIZADO*\n*Cliente:* ${this.obs.controls['nome'].value}\n*Pedido:*\n${pedidos}*Forma de pagamento:* ${this.obs.controls['pgt'].value}\n${txtTaxa}\n*Desconto:* ${descTxt}\n*Troco:* ${trocoTxt}\n${entrega}\n*Observação:* ${this.obs.controls['observation'].value}\n\n*${txtTotal}* R$${this.total.toFixed(2)} ${taxaMsg}`

    

    let celular = `55${this.url?.whatsapp}`
    let msg = window.encodeURIComponent(info)
    window.open(`https://api.whatsapp.com/send?phone=${celular}&text=${msg}`)
  }


  finishPremium() {

    let info = ''
    let entrega = ''
    this.loading = true

    if (this.entrega == 'false') {
      entrega = `${this.url?.endereco}`
    } else {
      entrega = `${this.obs.controls['endereco'].value}`
    }

    let selectionSabor = []
    selectionSabor = this.sabor.controls['sabores'].value
    let pedido : string[] = []
    for (let p in this.cart) {

      if (selectionSabor[p] != '') {
        selectionSabor[p] = `- Sabor: ${selectionSabor[p]}`
      } else {
        selectionSabor[p] = ''
      }

      pedido.push(`${this.cart[p].quantidade} x ${this.cart[p].pedido} - R$${this.cart[p].preco} ${selectionSabor[p]}`)
      //pedidos += 

    }


    let trocoInfo = ""
    let taxaMsg = ""
    let txtTotal = ""
    let trocoFinal = 0
    let trocoTxt = ""

    if (this.obs.controls['pgt'].value == 'Dinheiro' && this.obs.controls['troco'].value != null) {
      trocoInfo = `${this.obs.controls['troco'].value}`
      trocoFinal = parseInt(trocoInfo)
      trocoTxt = `R$${trocoFinal.toFixed(2)}`
    }

    if (this.obs.controls['delivery'].value == 'true') {
      taxaMsg = " + _Taxa de Entrega_ "
      txtTotal = 'SUBTOTAL:'
    } else {
      txtTotal = 'TOTAL:'
    }

    let descTxt = ''
    let desc = 0
    if (this.desconto > 0) {
      let txt = this.total * (this.desconto / 100)
      desc = this.total * (this.desconto / 100) 
      descTxt = ` R$ ${txt.toFixed(2)}`
    } else {
      descTxt = "Sem desconto"
      desc = 0
    }

    //info = `${this.url?.nome} - *PEDIDO FINALIZADO*\n*Cliente:* ${this.obs.controls['nome'].value}\n*Pedido:*\n${pedidos}*Forma de pagamento:* ${this.obs.controls['pgt'].value}\n*Desconto:* ${descTxt}\n*Troco:* ${trocoTxt}\n${entrega}\n*Observação:* ${this.obs.controls['observation'].value}\n\n*${txtTotal}* R$${this.total.toFixed(2)} ${taxaMsg}`

    let tipEntrega : boolean
    if (this.entrega == 'false') {
      tipEntrega = false
    } else {
      tipEntrega = true
    }

    this.auth.authState.subscribe(user =>{
      let docId = this.url?.uid+ uuid.v4()
    var pedidoOnline : PedidosOnline = {
      nomeCliente: this.obs.controls['nome'].value,
      pedido: pedido,
      delivery: tipEntrega,
      desconto: desc,
      idVendedor : this.url?.uid,
      formaPagamento: this.obs.controls['pgt'].value,
      nomeVendedor: this.url?.nome,
      observacao: this.obs.controls['observation'].value,
      preco : this.total,
      timestamp: Date.now(),
      endereco: entrega,
      telefoneVendedor: this.url?.whatsapp,
      idCliente: user?.uid,
      telefoneCliente:this.obs.controls['fone'].value,
      docId: docId,
      status: 1,
      troco: this.obs.controls['troco'].value,
      entregaTaxa: + this.taxa!

    }

    this.premiumService.finishOrder(docId, pedidoOnline).then(() => {
      this.notify.notifications('Pedido feito com sucesso')
      this.loading = false;
      this.router.navigateByUrl(`/d/${sessionStorage.getItem('url')}`)
      this.shopService.prod = []
      this.shopService.pedido = []
    }).catch(error =>{
      this.notify.notifications(error)
    })
    
    })
    
    /*let celular = `55${this.url?.whatsapp}`
    let msg = window.encodeURIComponent(info)
    window.open(`https://api.whatsapp.com/send?phone=${celular}&text=${msg}`)*/
    
    
  }


  remove(i: number) {


    /*this.cart[i].preco = (this.cart[i].preco / this.cart[i].quantidade)

    this.cart[i].quantidade -= 1

    this.cart[i].preco = this.cart[i].preco * this.cart[i].quantidade

    //console.log(this.cart[i].preco);

    this.total = this.cart.reduce((prev, elem) => prev + elem.preco, 0)

    this.shopService.removePedido(i)*/

    this.total = (this.total + (this.cart[i].preco * this.desconto / 100)) - (this.cart[i].preco)
    this.shopService.removePedido(i)
    if (this.cart.length == 0) {
      this.taxa = 0 
      this.total = 0
    }


  }


  goToBack() {
    let letter = ''
    if(this.url?.receberPorWhatsapp){
      letter = 'm'
    }else {
      letter = 'd'
    }
    this.router.navigateByUrl(`/${letter}/${this.url?.nomeUrl}`, { replaceUrl: true })
  }


}

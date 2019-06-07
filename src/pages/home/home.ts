import { Component, ɵConsole } from '@angular/core';
import { NavController, AlertController, ModalController,ModalOptions } from 'ionic-angular';
import { Http } from '@angular/http'; //https://stackoverflow.com/questions/43609853/angular-4-and-ionic-3-no-provider-for-http
import {DatabaseProvider } from '../../providers/database/database';
import { BackgroundMode } from '@ionic-native/background-mode';
import { NativeAudio } from '@ionic-native/native-audio';
import { LocalNotifications } from '@ionic-native/local-notifications';
import { Platform } from 'ionic-angular';
import { CrearCitaPage } from '../crear-cita/crear-cita';
import { LoadingController } from 'ionic-angular';

import { UniqueDeviceID } from '@ionic-native/unique-device-id';


@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})

export class HomePage {    
  
    loading:any;
    isPainted:boolean = false;
    resp:any;
    band=0;
    data:any = {};
    data2:any = {};
    horarios_medico:any;
    numeroFilas:any;
    eventsCalendar = [];
    contadorCitas = 0;
    bodyNotification:string = "Corriendo en segundo plano";
    isIosDevice:boolean=false;
    fechaActual:any;
    
  constructor(private modal:ModalController, private uniqueDeviceID: UniqueDeviceID, public loadingCtrl: LoadingController, public plt: Platform, private localNotifications: LocalNotifications, public nativeAudio: NativeAudio , private backgroundMode: BackgroundMode,public navCtrl: NavController, private http:Http,private alertCtrl: AlertController, private database: DatabaseProvider) {

    this.data.username = '';
    this.data.response = '';    
    this.http = http;  
    this.fechaActual = new Date().toISOString();
    
    if(window.localStorage.getItem("numFilasDBremota") == null){
        window.localStorage.setItem("numFilasDBremota","0")
    }
    
    
    //Precargamos el audio para poder utilizarlo en las notificaciones de una actualizacion de la BD
    this.nativeAudio.preloadSimple('audio1', 'audio/good.mp3').then((msg)=>{
        console.log("message: " + msg);
    }, (error)=>{
        console.log("error: " + error);
    });
  
    this.backgroundMode.setDefaults({
        title: "Agenda TM",
        text: this.bodyNotification,
        icon: 'icon2.png', // this will look for icon.png in platforms/android/res/drawable|mipmap
        color: '65cab6', // hex format like 'F14F4D'
        bigText: true    
    })


    this.uniqueDeviceID.get()
  .then((uuid: any) => {
    console.log("UUID Nuevo: "+uuid)
    localStorage.setItem("UUID_Phone",uuid);


    this.verificarActualizacionDeDatosRemotosEnBackground() //Verificaremos los datos de la BD remota cada 10 segundos
    this.insertIdMedicoToken()

    
  })
  .catch((error: any) => {
    console.log("ERROR Nuevo: "+error)
  });

 

  localStorage.setItem("alertDatosConsultadosLanzada","0")

  
  } //Fin del Constructor

/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/          

agregarCita(){
  this.navCtrl.push(CrearCitaPage);  
}



addZero=(i)=>{
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}

obtenerFecha(formatoDate){

  let dd = formatoDate.getDate();

  let  mm = formatoDate.getMonth()+1; 
  let yyyy = formatoDate.getFullYear();

  if(dd<10) 
  {
    dd='0'+dd;
  } 

  if(mm<10) 
  {
    mm='0'+mm;
  } 


  let fecha = yyyy+'-'+mm+'-'+dd;
  return fecha;
}

obtenerHora(formatoDate){
  let h = this.addZero(formatoDate.getHours());
  var m = this.addZero(formatoDate.getMinutes());
  var s = this.addZero(formatoDate.getSeconds());
  return h+":"+m+":"+s;
}

verDetallesEventoModal(evento){  

  const myModalOptions:ModalOptions={

    enableBackdropDismiss:false

  }

  const myModal = this.modal.create('ModalPage',{data:evento},myModalOptions);  
  myModal.present();

  myModal.onDidDismiss((data)=>{
    //alert("Ya fui minimizado!!")
    //alert("Modal: "+this.resp['respValue'])
    if(this.resp['respValue'] == 200){
      this.consultarHorariosBDremota2()
    }else{
      this.clearCalendar()
    }

  })
}

actualizarAgenda(){

  localStorage.setItem("alertDatosConsultadosLanzada","0")

this.consultarHorariosBDremota2();

//Mensaje de actualizacion con un spinner
  this.loading = this.loadingCtrl.create({
    spinner: 'circles',
    content: `
      <div class="custom-spinner-container">
        <div class="custom-spinner-box">Actualizando las citas de su agenda...</div>
      </div>`,
    //duration: 1000
  });

  this.loading.onDidDismiss(() => {
    console.log('Dismissed loading');
  });

  this.loading.present();
}

// Schedule a single notification
lanzarNotificacion2(){
this.localNotifications.schedule({  
  title: 'Notificacion demo',  
  text:"Mi texto"
});
}

lanzarNotificacion(){ //Hay un problema al tener notificaciones locales y notificaciones push en ios y android > 6
  console.log("Lanzando notificacion\n"+"Titulo: "+localStorage.getItem("TitleNotification")+"\nTexto: "+localStorage.getItem("MessageNotification"))
    this.localNotifications.schedule({
        title: localStorage.getItem("TitleNotification"),
        text: localStorage.getItem("MessageNotification"),
        //attachments: ['file://img/activado.png'],//Pone una imagen en la notificacion
        sound: 'file://audio/good.mp3', //Solo funciona en iOS
        icon: 'file://img/green_notification.png', // this will look for icon.png in platforms/android/res/drawable|mipmap
        foreground: true
    });
}

/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/          


ionViewDidLoad() {                                   

this.consultarHorariosBDremota2()


  if (this.plt.is('android')) {
    setInterval(() => {
      if(this.backgroundMode.isActive()==false){
          console.log("checarCambiosNotificacionesRecibidas() En el foreground")
          this.checarCambiosNotificacionesRecibidas()
      }
    }, 3000);   
  }

}
/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/          

verificarActualizacionDeDatosRemotosEnBackground(){
    this.backgroundMode.enable(); //Habilitamos el modo background
    //alert("Mensaje desde funcion en fondo")
    
    var resultadoBoolean = this.backgroundMode.isEnabled(); //Esto nos servira para saber si esta habilitado
    //alert("Esta habilitado BackgroundMode: "+resultadoBoolean)

    //Funcion que se ejecuta cuando se minimiza el app
    this.backgroundMode.on("activate").subscribe(()=>{        
        //alert("Imprimiendo datos de fondo...Esta activo")


     


  if(this.plt.is('android')) {
    setInterval(() => {
      if(this.backgroundMode.isActive()==true){
          console.log("checarCambiosNotificacionesRecibidas() En el background")
          this.checarCambiosNotificacionesRecibidas();
      }
    }, 3000); 
  }


    }); 
        
  }

/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/           
  public playAudio(){
/*      
    this.backgroundMode.enable();    
    this.backgroundMode.on("activate").subscribe(()=>{
      this.nativeAudio.play("audio1");  
    });
*/    
    this.nativeAudio.play("audio1"),() => console.log('audio1 is done playing');

  }


  /**************************************************************************************************************/
  /**************************************************************************************************************/            
  /**************************************************************************************************************/            
checarCambiosNotificacionesRecibidas(){  
  
  if(localStorage.getItem("NotificacionRecibida") != null){
    console.log("VaLOR DEL ESTADO DE NOTIFICACIONES: "+localStorage.getItem("NotificacionRecibida"))
    //this.backgroundMode.on("activate").subscribe(()=>{  
      if(localStorage.getItem("NotificacionRecibida") == "1"){
          this.consultarHorariosBDremota2()          
      }
    //})
  }  
}
  /**************************************************************************************************************/
  /********** Esta se tiene que ejecutar para obtener los datos de la BD en el servidor de expediente ***********/
  /**************************************************************************************************************/          
  consultarHorariosBDremota2(){
  
      console.log("Estado notificacion recibida: "+localStorage.getItem("NotificacionRecibida"))
      //alert("Se haran cambios en la base local por que se detectó una notificacion") 

      var link = 'https://topmedic.com.mx/accessDatabase/wp_DB/service/recibirDatos.php';
      
      var id_medico = JSON.stringify({id_medico: window.localStorage.getItem("id_doctor")});
            
        this.http.post(link, id_medico)
        .subscribe(data => {
            this.data.response = data["_body"]; 

            this.resp = JSON.parse(this.data.response);

            //alert("RespValue: "+this.resp['respValue'])

                  if(this.resp['respValue'] == "200" ){
                    this.horarios_medico = JSON.stringify(this.resp['horarios']);
                    this.numeroFilas = JSON.stringify(this.resp['numFilas']);
                    console.log("Resultado consulta: "+JSON.stringify(this.resp))
                    window.localStorage.setItem("numFilasDBActual",this.numeroFilas)
                    //alert("LocalStorageXD: "+window.localStorage.getItem("numFilasDBremota")+" numberFilas:"+this.numeroFilas)
                                  
                    //Limpiamos la BD local para poder insertar los nuevos valores de la BD remota
                    //alert("Hay datos nuevos que agregar ")
                    this.isPainted = false;
                    this.eventsCalendar.splice(0,this.eventsCalendar.length) //Vaciar el arreglo que contiene los elementos a pintar en el calendario
                    this.clearTable();       
                    //alert("Estado notificacion: "+localStorage.getItem("NotificacionRecibida"))
                    if(localStorage.getItem("NotificacionRecibida")=="1"){
                      //alert("Ha llegado una notificacion!")
                      this.lanzarNotificacion();
                    }
                    //this.playAudio(); //Esta funcion la utilizabamos antes de usar las notificaciones
                    localStorage.setItem("NotificacionRecibida","0")
                }else if(this.resp['respValue'] == "400" ){
                  //this.resp="400"
                  this.loading.dismiss();
                  if(localStorage.getItem("alertDatosConsultadosLanzada") == "0"){
                    this.clearCalendar()
                    alert("No hay citas disponibles")
                    //this.consultarHorariosBDremota2()
                  }
                  localStorage.setItem("alertDatosConsultadosLanzada","1")               
                }

        },  error => {
            console.log("Oooops!");
            alert("No se pudieron enviar los datos\nIntentelo mas tarde");
            });
  
  }

  /**************************************************************************************************************/
  /**************************************************************************************************************/            
  /**************************************************************************************************************/            

  insertIdMedicoToken(){    

    //var link = 'http://93.104.215.239/ecg_mqtt/DATABASE/insertarAgendaMedicos.php';
    var link = 'https://topmedic.com.mx/accessDatabase/wp_DB/service/recibirDatos.php';
    
    var id_token = JSON.stringify({id_medico: window.localStorage.getItem("id_doctor"), tokenPhoneMedico:localStorage.getItem("phoneToken"),UUID_Phone:localStorage.getItem("UUID_Phone")});
          
    
    //alert("Se enviaran los datos: "+JSON.stringify({id_medico: window.localStorage.getItem("id_doctor"), tokenPhoneMedico:localStorage.getItem("phoneToken")}))

          try {

            this.http.post(link, id_token)                  
            .subscribe(data => {              
      
              this.data2.response = data["_body"]; 

              //alert(JSON.stringify(this.data2.response))
     
              var resp = JSON.parse(this.data2.response);                            
              
                  if(resp['response'] == "200"){
                        //alert("Se insertaron correctamente los datos en la bd")
                        console.log("Se insertaron correctamente los datos en la bd")
                  }else if(resp['response'] == "100"){
                    //alert("Los datos de este medico ya se habian registraron en la BD")
                    console.log("El token de las notificaciones push se ha actualizado en la BD")
                  }else{
                    //alert("No se pudieron insertar los datos :(")
                    console.log("No se pudieron insertar los datos :(")
                  }
                  
              }, error => {

                alert("No se pudieron enviar los datos\nIntentelo mas tarde");          
              });
      
            } catch (error) {
              alert("Hay un error en el servidor")
            }

  
          
  }

/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/  
     
almacenarHorariosEnLocalBD(fecha_consulta: string, hora:string, horb:string, descripcion: string, link_token: string,tipo_servicio:string, booking_id:string, edad_paciente: string, Sexo:string, padecimiento: string,nombre_completo_paciente:string, numCitas:number){
    this.database.almacenarCitasEnBD(fecha_consulta, hora,horb,descripcion, link_token,tipo_servicio,booking_id, edad_paciente, Sexo, padecimiento,nombre_completo_paciente, numCitas).then((data) =>{                
        console.log(JSON.stringify("Numero de datos insertados: "+data))
        
        if(JSON.stringify(data) == numCitas+""){
            //alert("Se agregaron todas las citas de la BD remota a la DB local")
            this.getCitas();
        }

    },(error) => {
        console.log("Error al crear usuario: "+error)
        //alert("xdxdxd: "+error)
        //alert("Error al crear: "+error)
    })
    
}
/**************************************************************************************************************/
/*************** Con esta funcion obtendremos las citas del medico almacenadas en la BD local *****************/
/**************************************************************************************************************/
getCitas(){
    this.eventsCalendar = []; //Vaciamos el arreglo por si tiene eventos anteriores
    
    //Usamos la funcion creada en el proveedor database.ts para obtener los datos de las citas
    this.database.obtenerCitas().then((data: any) => {
      console.log("Resultado getCitas(): "+JSON.stringify(data.length));

        //if(this.contadorCitas == 0){

            //alert("Ahora pintaremos "+data.length+" citas en el calendario")
            for (let i = 0; i < data.length; i++) {
                const element = data[i];            
                
                let fecha_consulta_g = JSON.stringify(data[i]['fecha_consulta'])
                let hora_g = JSON.stringify(data[i]['hora'])
                let horb_g = JSON.stringify(data[i]['horb'])
                let descripcion_g = JSON.stringify(data[i]['descripcion'])


                let fecha_consulta_SC = fecha_consulta_g.replace(/"/g, ''); 
                var hora_SC = hora_g.replace(/"/g, ''); 
                var horb_SC = horb_g.replace(/"/g, ''); 
                var descripcion_SC = descripcion_g.replace(/"/g, ''); 

                
                //alert("Desde funcion getcitas principal : Fecha "+fecha_consulta_SC+" Hora: "+hora_SC+" "+" Hora Fin"+horb_SC)
                //Con esta linea mandamos a actualizar los eventos de la BD local en el calendario
                this.eventSource = this.addSchedules(fecha_consulta_SC, hora_SC, horb_SC, descripcion_SC);
                this.isPainted = true;
            }
            this.contadorCitas = 1;
/*
        }else{
            alert("Ya no se puede realizar mas consultas")
        }
*/
    }, (error) => {
      console.log(error);
      //alert("error: "+error)
    })
    this.loading.dismiss(); 
  }

/**************************************************************************************************************/
/*************************** Obtener detalles de la cita seleccionana en el calendario ************************/
/**************************************************************************************************************/

getDetallesCitaSeleccionada(fechaCitaSeleccionada,horaInicioCitaSeleccionada,horaFinCitaSeleccionada){  
  
  //Usamos la funcion creada en el proveedor database.ts para obtener los datos de las citas
  this.database.obtenerCamposCitaSeleccionada(fechaCitaSeleccionada,horaInicioCitaSeleccionada,horaFinCitaSeleccionada).then((data: any) => {
    

          for (let i = 0; i < data.length; i++) {
              const element = data[i];            
              
              let fecha_consulta_g = JSON.stringify(data[i]['fecha_consulta'])
              let hora_g = JSON.stringify(data[i]['hora'])
              let horb_g = JSON.stringify(data[i]['horb'])
              let descripcion_g = JSON.stringify(data[i]['descripcion'])
              let link_token_g = JSON.stringify(data[i]['link_token'])
              let tipo_servicio_g = JSON.stringify(data[i]['tipo_servicio'])

              let booking_id_g = JSON.stringify(data[i]['booking_id'])
              let edad_paciente_g = JSON.stringify(data[i]['edad_paciente'])
              let Sexo_g = JSON.stringify(data[i]['Sexo'])
              let padecimiento_g = JSON.stringify(data[i]['padecimiento'])
              let nombre_completo_paciente_g = JSON.stringify(data[i]['nombre_completo_paciente'])
              //alert(fecha_consulta_g+" "+hora_g+" "+horb_g+" "+descripcion_g+" "+link_token_g)

              let fecha_consulta_SC = fecha_consulta_g.replace(/"/g, ''); 
              var hora_SC = hora_g.replace(/"/g, ''); 
              var horb_SC = horb_g.replace(/"/g, ''); 
              var descripcion_SC = descripcion_g.replace(/"/g, ''); 
              var link_token_SC = link_token_g.replace(/"/g, '');               
              var tipo_servicio_SC = tipo_servicio_g.replace(/"/g, '');   

              var booking_id_SC = booking_id_g.replace(/"/g, ''); 
              var edad_paciente_SC = edad_paciente_g.replace(/"/g, ''); 
              var Sexo_SC = Sexo_g.replace(/"/g, ''); 
              var padecimiento_SC = padecimiento_g.replace(/"/g, '');               
              var nombre_completo_paciente_SC = nombre_completo_paciente_g.replace(/"/g, '');   

              let objectNotification = {
                "fecha_consulta": fecha_consulta_SC, 
                "hora": hora_SC, 
                "horb": horb_SC, 
                "descripcion": descripcion_SC, 
                "link_token": link_token_SC, 
                "tipo_servicio": tipo_servicio_SC,
                "booking_id":booking_id_SC,
                "edad_paciente":edad_paciente_SC,
                "Sexo":Sexo_SC,
                "padecimiento":padecimiento_SC,
                "nombre_completo_paciente":nombre_completo_paciente_SC
              };

              //alert(typeof(objectNotification))
              this.verDetallesEventoModal(objectNotification)
          }    
          
         

  }, (error) => {
    console.log(error);
    //alert("error: "+error)
  })
  
}
/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/          

  rellenarArregloConConsultaBDremota(){


    //alert("Valor de la respuesta en la funcion rellenar: "+this.resp['respValue']+"\n\nthis.horarios_medico: \n"+this.horarios_medico)


    if(this.horarios_medico !== undefined){

      var resp2 = JSON.parse(this.horarios_medico);
      var nFilas = JSON.parse(this.numeroFilas);

          //alert("Se agregaran "+nFilas+" nuevas filas")


            if(this.resp['respValue'] == "200"){

              for (let i = 0; i < Object.keys(resp2).length; i++) {
                  const element = this.resp['horarios'][i];
                  var fecha_consulta = JSON.stringify(element['fecha_consulta'])
                  var hora = JSON.stringify(element['hora'])
                  var horb = JSON.stringify(element['horb'])
                  var descripcion = JSON.stringify(element['descripcion'])
                  var link_token = JSON.stringify(element['token'])

                  var nombre = JSON.stringify(element['nombre_paciente'])
                  var aPaterno = JSON.stringify(element['paterno'])
                  var tipo_servicio = JSON.stringify(element['tipo_servicio'])


                  var booking_id = JSON.stringify(element['booking_id'])
                  var edad_paciente = JSON.stringify(element['edad_paciente'])
                  var Sexo = JSON.stringify(element['Sexo'])
                  var padecimiento = JSON.stringify(element['padecimiento'])

                

                  var fecha_consulta_SC = fecha_consulta.replace(/"/g, ''); 
                  var hora_SC = hora.replace(/"/g, ''); 
                  var horb_SC = horb.replace(/"/g, ''); 
                  var descripcion_SC = descripcion.replace(/"/g, '');
                  var tipo_servicio_SC = tipo_servicio.replace(/"/g, '');
                
                  var nombre_SC = nombre.replace(/"/g, '');
                  var aPaterno_SC = aPaterno.replace(/"/g, '');
                  var link_token_SC = link_token.replace(/"/g, '');
                
                  var booking_id_SC = booking_id.replace(/"/g, ''); 

                  var edad_paciente_SC = edad_paciente.replace(/"/g, ''); 
                  var Sexo_SC = Sexo.replace(/"/g, ''); 
                  var padecimiento_SC = padecimiento.replace(/"/g, '');


                  var nombre_completo_paciente = nombre_SC+" "+aPaterno_SC;
                  var descripcionCompuesta = descripcion_SC; 
                  //var descripcionCompuesta = "Cita con "+nombre_SC+" "+aPaterno_SC+" "+descripcion_SC; 
                  //alert(" "+nombre_SC+" "+aPaterno_SC+" "+" "+aMaterno_SC);
                
                  //this.eventSource es el evento en el html que se ira refrescando 
                  //this.eventSource = this.addSchedules(fecha_consulta_SC, hora_SC, horb_SC, descripcion_SC);
                  this.almacenarHorariosEnLocalBD(fecha_consulta_SC, hora_SC, horb_SC, descripcionCompuesta,link_token_SC,tipo_servicio_SC, booking_id_SC, edad_paciente_SC,Sexo_SC,padecimiento_SC, nombre_completo_paciente, nFilas);
              }
              window.localStorage.setItem("numFilasDBremota",window.localStorage.getItem("numFilasDBActual"))
            }else{
              alert("Hubo un error en la consulta de los horarios")  
              this.clearCalendar()
            }
    }else{
      this.clearCalendar()
    }
  }


  clearCalendar(){
    //alert("Tam de arrayCitas: "+this.eventsCalendar.length)
    this.eventsCalendar = []; 
    this.eventSource = this.addSchedules(" "," "," "," "); 
  }
/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/          
clearTable(){

    //alert("Entrando a limpiar tabla local")
    this.database.limpiarTabla().then((data) =>{
        console.log("Tabla Borrada: "+JSON.stringify(data))
        //alert("Tabla local Borrada!!!");
        //alert("Rellenaremos el arreglo para insertar en la BD local")
        this.rellenarArregloConConsultaBDremota();

    },(error) => {
        console.log("Error no se pudo borrar tabla: "+error)
        //alert("Error no se pudo borrar tabla: "+error)
        this.clearTable()
    })
}
/**************************************************************************************************************/
/**************************************************************************************************************/
/**************************************************************************************************************/            
  eventSource;
  viewTitle;
  isToday: boolean;
  calendar = {
      locale: 'es-MX',
      autoSelect: 'true',
      mode: 'month',
      currentDate: new Date()
  }; // these are the variable used by the calendar.
  loadEvents() {
      //this.eventSource = this.createRandomEvents();
      //this.eventSource = this.addEvent();      
          //Formato de la base de datos de Saul
          this.eventsCalendar = [];
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion');
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion');
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion');
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion');
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion');
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion');
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
      this.eventSource = this.addSchedules('2019-05-10','17:30:00','20:30:00','Mi descripcion'); 
  }

  onViewTitleChanged(title) {
      this.viewTitle = title;
  }
  onEventSelected(event) {
      console.log('Event selected:' + event.startTime + '-' + event.endTime + ',' + event.title);
      //alert(event.title)
      //this.alertDetallesEvento( event.title )
      const miCita = {titulo:event.title,inicio:event.startTime,fin:event.endTime}

      //Aqui separaremos los valores que necesitaremos para hacer la consulta en la BD local
      let fechaCitaSeleccionada = this.obtenerFecha(event.startTime);
      let horaInicioCitaSeleccionada = this.obtenerHora(event.startTime);
      let horaFinCitaSeleccionada = this.obtenerHora(event.endTime);
      //alert (fechaCitaSeleccionada+" "+horaInicioCitaSeleccionada+" "+horaFinCitaSeleccionada)

  
/*
//Eliminar este segmento de codigo pues solo sirve para nostrar el modal en el navegador web
      let objectNotification = {
        "fecha_consulta": fechaCitaSeleccionada, 
        "hora": horaInicioCitaSeleccionada, 
        "horb": horaFinCitaSeleccionada, 
        "descripcion": event.title, 
        "link_token": "jghavdshvdfhagvdfhagvdshnvf", 
        "tipo_servicio": "Video asistencia",
        "booking_id":"8",
        "edad_paciente":"27",
        "Sexo":"Hombre",
        "padecimiento":"Dolor estomacal severo",
        "nombre_completo_paciente":"Xavi Avelino"
      };
      this.verDetallesEventoModal(objectNotification)
*/


      //Aqui ira la consulta a la BD local por fecha y hora 
      let camposDBcitaSeleccionada = this.getDetallesCitaSeleccionada(fechaCitaSeleccionada,horaInicioCitaSeleccionada,horaFinCitaSeleccionada)

      //alert("camposDBcitaSeleccionada: "+JSON.stringify(camposDBcitaSeleccionada))
      ///Aqui enviaremos los parametros consultados al modal para poder visualizarlos
//      this.verDetallesEventoModal(miCita)
//        this.verDetallesEventoModal(camposDBcitaSeleccionada)
           
  }
  changeMode(mode) {
      this.calendar.mode = mode;
  }
  today() {
      this.calendar.currentDate = new Date();
  }
  onTimeSelected(ev) {
      console.log('Selected time: ' + ev.selectedTime + ', hasEvents: ' +
          (ev.events !== undefined && ev.events.length !== 0) + ', disabled: ' + ev.disabled);
  }
  onCurrentDateChanged(event:Date) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      event.setHours(0, 0, 0, 0);
      this.isToday = today.getTime() === event.getTime();

      //alert("Cambio de pantalla")
  }
  ionViewWillEnter(){

    //alert("Entrando a la pagina activa")

  }


  alertDetallesEvento(evento){

    let alert = this.alertCtrl.create({
      title: '<center><h4>Detalles</h4></center>',
      subTitle: evento,
      buttons: ['Aceptar']
    });
    alert.present();
  }
    
/********************************************************************************************************/
/****************************** Funcion para agregar un evento manualmente  *****************************/
/********************************************************************************************************/
  //Agregar eventos uno a uno de la base de datos
  //createEvent(title, location, notes, startDate, endDate)
  addEvent(){

    this.eventsCalendar.splice(0,this.eventsCalendar.length)
    
    var startTime;
    var endTime;
    var events2 = [];

    //Formato de la base de datos de Saul
    startTime = "2019-05-10 17:30:00"
    endTime = "2019-05-10 18:00:00"

    var startTime3v = "2019-05-10 17:30:00"
    var endTime3v = "2019-05-10 17:30:00" 


    var startTimeMOD = startTime;
    //var stm = new Date(startTimeMOD.replace(' ', 'T'));
    var stm = new Date(startTimeMOD.replace(/-/g, '/'));

    var endTimeMOD = endTime;
    //var stmf = new Date(endTimeMOD.replace(' ', 'T'));
    var stmf = new Date(endTimeMOD.replace(/-/g, '/'));

    let startTime2 = new Date(startTime);
    let endTime2 = new Date(endTime);
    
    let startTime3 = new Date(startTime3v);
    let endTime3 = new Date(endTime3v);

    this.eventsCalendar.push({
        title: 'Cita con paciente Jorge',
        startTime: stm,
        endTime: stmf,
        allDay: false        
    },
    {
        title: 'Cita con paciente Maria',
        startTime: stm,
        endTime: stmf,
        allDay: false        
    }

    );


    alert("Se a agregado un evento")
    //alert(startTime2)
    alert("startTime2: "+stm+"\nendTime: "+stmf)
    return this.eventsCalendar;
  }

/********************************************************************************************************/
/********************* Funcion para agregar los horarios descargados desde la BD ************************/
/********************************************************************************************************/

    //Agregar eventos uno a uno de la base de datos
  //createEvent(title, location, notes, startDate, endDate)
  addSchedules(dateM, startHour, endHour, description){
  
    
    var startTime;
    var endTime;
    
     //Formato de la base de datos de Saul
    startTime = dateM+" "+startHour;
    endTime = dateM+" "+endHour; 

    let inicio = new Date(startTime);
    let fin = new Date(endTime);
    

    var startTimeMOD = startTime;
    //var stm = new Date(startTimeMOD.replace(' ', 'T'));
    var stm = new Date(startTimeMOD.replace(/-/g, '/'));

    var endTimeMOD = endTime;
    //var stmf = new Date(endTimeMOD.replace(' ', 'T'));
    var stmf = new Date(endTimeMOD.replace(/-/g, '/'));

    if (this.plt.is('ios')) {
      // This will only print when on iOS
      console.log('I am an iOS device!');

        this.eventsCalendar.push({
          title: description,
          startTime: stm,
          endTime: stmf,
          allDay: false        
        });  

        //alert("stm: "+stm+"\stmf: "+stmf)
        console.log("stm: "+stm+"\stmf: "+stmf)

    }else if (this.plt.is('android')) {
      // This will only print when on iOS
      console.log('I am an android device!');
        this.eventsCalendar.push({
          title: description,
          startTime: inicio,
          endTime: fin, 
          allDay: false     
        });

        //alert("inicio: "+inicio+"\nendTime: "+fin)
        console.log("inicio: "+inicio+"\nendTime: "+fin)
    }

/*
    alert("Se a agregado un evento")    
    alert("startTime: "+startTime+"\nendTime: "+endTime)
    alert("inicio: "+inicio+"\nendTime: "+fin)
    alert("Tamaño arreglo consultas: "+this.eventsCalendar.length)
    alert("Contenido arreglo consultas: "+JSON.stringify(this.eventsCalendar[0]))
    console.log("Contenido arreglo consultas: "+JSON.stringify(this.eventsCalendar[0]))
*/
    
    return this.eventsCalendar;
  }
/********************************************************************************************************/
/********************************************************************************************************/
/********************************************************************************************************/



  onRangeChanged(ev) {
    console.log('range changed: startTime: ' + ev.startTime + ', endTime: ' + ev.endTime);
  }


  markDisabled = (date:Date) => {
      var current = new Date();
      current.setHours(0, 0, 0);
      return date < current;
  };
    

}

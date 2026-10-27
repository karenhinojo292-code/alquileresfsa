import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import {launchImageLibrary, Asset} from 'react-native-image-picker';

// Dirección base de la API (en el celular que va  llegar al apche)
const API_URL = 'http://localhost:8080/alquilerFsa/api';

// Las fotos se guardan como "uploads/xxxx.jpg" dentro de la carpeta de la API
const urlFoto = (ruta: string) => `${API_URL}/${ruta}`;
// Alto de la barra de estado de Android: la app se dibuja debajo de ella y hay que dejarle lugar
const ALTO_BARRA = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
// Ancho de la foto del carrusel: pantalla menos el margen de 20 a cada lado
const ANCHO_FOTO = Dimensions.get('window').width - 40;

// Paleta de colores :
const C = {
  oscuro: '#2D3937',
  verde: '#5A6E60',
  verdeClaro: '#E4E9E5',
  melon: '#ecbbb5',
  fondo: '#F4F1ED',
  papel: '#FFFFFF',
  texto: '#2D3937',
  suave: '#6B675C',
  linea: '#C5BEB4',
  error: '#A8322D',
};

type Propiedad = {
  id: number;
  direccion: string;
  precio: string;
  habitaciones: number;
};

type Foto = {id: number; ruta_url: string};

type Detalle = Propiedad & {
  descripcion: string | null;
  imagenes: Foto[];
  propietario: string;
  contacto: string | null;
  email_contacto: string;
};

function formatearPrecio(precio: string): string {
  const entero = Math.round(Number(precio));
  return '$' + String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function textoAmbientes(n: number): string {
  return `${n} ${n === 1 ? 'ambiente' : 'ambientes'}`;
}

// Teléfono: 10 dígitos, sin 0 ni 15 al principio (ej: 3704123456)
function telefonoValido(t: string): boolean {
  return /^[1-9]\d{9}$/.test(t) && !t.startsWith('15');
}

// Botón propio: primario (relleno), secundario (borde) o texto
function Boton(props: {
  titulo: string;
  onPress: () => void;
  tipo?: 'primario' | 'secundario' | 'texto' | 'peligro';
}) {
  const tipo = props.tipo ?? 'primario';
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={props.onPress}
      style={[
        st.boton,
        tipo === 'primario' && st.botonPrimario,
        tipo === 'secundario' && st.botonSecundario,
        tipo === 'texto' && st.botonTexto,
        tipo === 'peligro' && st.botonPeligro,
      ]}>
      <Text
        style={[
          st.botonLetra,
          tipo === 'primario'
            ? {color: '#fff'}
            : tipo === 'peligro'
            ? {color: C.error}
            : {color: C.verde},
        ]}>
        {props.titulo}
      </Text>
    </TouchableOpacity>
  );
}

// Campo de texto con el estilo de la app
function Campo(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={C.suave}
      {...props}
      style={[st.input, props.style]}
    />
  );
}

function App(): React.JSX.Element {
  // Login
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [rol, setRol] = useState('');

  // Registro
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [rolReg, setRolReg] = useState<'Inquilino' | 'Propietario' | ''>('');
  const [rNombre, setRNombre] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPass, setRPass] = useState('');
  const [rPass2, setRPass2] = useState('');
  const [rTelefono, setRTelefono] = useState('');
  const [rDni, setRDni] = useState('');
  const [rDireccion, setRDireccion] = useState('');
  const [rDeclaracion, setRDeclaracion] = useState(false);
  const [rEnviando, setREnviando] = useState(false);
  const [rMensaje, setRMensaje] = useState('');

  // Catálogo
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [filtro, setFiltro] = useState('');
  const [cargandoLista, setCargandoLista] = useState(false);
  const [mensajeLista, setMensajeLista] = useState('');

  // Detalle
  const [idDetalle, setIdDetalle] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mensajeDetalle, setMensajeDetalle] = useState('');

  // Publicar
  const [publicando, setPublicando] = useState(false);
  const [nDireccion, setNDireccion] = useState('');
  const [nPrecio, setNPrecio] = useState('');
  const [nHabitaciones, setNHabitaciones] = useState('');
  const [nDescripcion, setNDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeForm, setMensajeForm] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [fotos, setFotos] = useState<Asset[]>([]);
  const [fotosActuales, setFotosActuales] = useState<Foto[]>([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoActual, setFotoActual] = useState(0);

  const ingresar = async () => {
    setMensaje('');
    if (email.trim() === '' || pass === '') {
      setMensaje('Complete el email y la contraseña');
      return;
    }
    setCargando(true);
    try {
      const r = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: email.trim(), pass}),
      });
      const datos = await r.json();
      if (r.ok) {
        setToken(datos.token);
        setRol(datos.rol);
        setPass('');
      } else {
        setMensaje(datos.error ?? 'No se pudo iniciar sesión');
      }
    } catch (error) {
      setMensaje('No se pudo conectar con la API');
    } finally {
      setCargando(false);
    }
  };

  const limpiarRegistro = () => {
    setRolReg('');
    setRNombre('');
    setREmail('');
    setRPass('');
    setRPass2('');
    setRTelefono('');
    setRDni('');
    setRDireccion('');
    setRDeclaracion(false);
    setRMensaje('');
  };

  // Valida en la app y la API vuelve a validar (RF01)
  const registrar = async () => {
    setRMensaje('');
    const tel = rTelefono.trim();
    const error =
      rNombre.trim() === '' || rEmail.trim() === '' || rPass === ''
        ? 'Complete nombre, email y contraseña'
        : rPass.length < 6
        ? 'La contraseña debe tener al menos 6 caracteres'
        : rPass !== rPass2
        ? 'Las contraseñas no coinciden'
        : tel !== '' && !telefonoValido(tel)
        ? 'El teléfono debe tener 10 dígitos con código de área, sin 0 ni 15 (ej: 3704123456)'
        : rolReg === 'Propietario' && tel === ''
        ? 'El teléfono es obligatorio para publicar alquileres'
        : rolReg === 'Propietario' && !/^\d{7,8}$/.test(rDni.trim())
        ? 'El DNI debe tener solo números, 7 u 8 dígitos'
        : rolReg === 'Propietario' && rDireccion.trim().length < 10
        ? 'La dirección debe tener al menos 10 caracteres'
        : rolReg === 'Propietario' && !rDeclaracion
        ? 'Debe aceptar la declaración jurada'
        : '';
    if (error !== '') {
      setRMensaje(error);
      return;
    }

    setREnviando(true);
    try {
      const cuerpo: Record<string, unknown> = {
        nombre: rNombre.trim(),
        email: rEmail.trim(),
        pass: rPass,
        rol: rolReg,
        telefono: tel,
      };
      if (rolReg === 'Propietario') {
        cuerpo.dni = rDni.trim();
        cuerpo.direccion = rDireccion.trim();
        cuerpo.declaracion_jurada = rDeclaracion;
      }
      const r = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();
      if (r.status === 201) {
        setEmail(rEmail.trim());
        limpiarRegistro();
        setModo('login');
        Alert.alert('Listo', 'Cuenta creada. Ya puede iniciar sesión.');
      } else {
        setRMensaje(datos.error ?? 'No se pudo crear la cuenta');
      }
    } catch (e) {
      setRMensaje('Error de conexión: ' + String(e));
    } finally {
      setREnviando(false);
    }
  };

  const cargarPropiedades = async (ambientes: string) => {
    setCargandoLista(true);
    setMensajeLista('');
    try {
      const t = ambientes.trim();
      const url =
        t === ''
          ? `${API_URL}/propiedades`
          : `${API_URL}/propiedades/buscar?ambientes=${encodeURIComponent(t)}`;
      const r = await fetch(url);
      const datos = await r.json();
      if (r.ok) {
        setPropiedades(datos);
      } else if (r.status === 404) {
        setPropiedades([]);
        setMensajeLista('No se encontraron propiedades');
      } else {
        setPropiedades([]);
        setMensajeLista(datos.error ?? 'Error al cargar las propiedades');
      }
    } catch (e) {
      setPropiedades([]);
      setMensajeLista('No se pudo conectar con la API');
    } finally {
      setCargandoLista(false);
    }
  };

  const abrirDetalle = async (id: number) => {
    setIdDetalle(id);
    setFotoActual(0);
    setDetalle(null);
    setMensajeDetalle('');
    setCargandoDetalle(true);
    try {
      const r = await fetch(`${API_URL}/propiedades/detalle?id=${id}`);
      const datos = await r.json();
      if (r.ok) {
        setDetalle(datos);
      } else {
        setMensajeDetalle(datos.error ?? 'No se pudo cargar la propiedad');
      }
    } catch (e) {
      setMensajeDetalle('No se pudo conectar con la API');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = () => {
    setIdDetalle(null);
    setDetalle(null);
    setMensajeDetalle('');
  };

  const cerrarFormulario = () => {
    setPublicando(false);
    setMensajeForm('');
  };

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNDireccion('');
    setNPrecio('');
    setNHabitaciones('');
    setNDescripcion('');
    setFotos([]);
    setFotosActuales([]);
  };

  // Formulario vacío para un anuncio nuevo
  const abrirNuevo = () => {
    if (editandoId !== null) {
      limpiarFormulario();
    }
    setMensajeForm('');
    setPublicando(true);
  };

  // Mismo formulario, cargado con los datos del anuncio para editarlo
  const abrirEdicion = (d: Detalle) => {
    setEditandoId(d.id);
    setNDireccion(d.direccion);
    setNPrecio(String(Math.round(Number(d.precio))));
    setNHabitaciones(String(d.habitaciones));
    setNDescripcion(d.descripcion ?? '');
    setFotosActuales(d.imagenes ?? []);
    setMensajeForm('');
    setPublicando(true);
  };

  // Pide confirmación y borra el anuncio
  const eliminarAnuncio = (id: number) => {
    Alert.alert(
      'Eliminar anuncio',
      '¿Querés eliminar este anuncio? No se puede deshacer.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setEliminando(true);
            try {
              const r = await fetch(`${API_URL}/propiedades/borrar`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({id}),
              });
              const datos = await r.json().catch(() => ({}));
              if (r.ok) {
                cerrarDetalle();
                cargarPropiedades(filtro);
                Alert.alert('Listo', 'Anuncio eliminado');
              } else {
                Alert.alert('Error', datos.error ?? 'No se pudo eliminar el anuncio');
              }
            } catch (e) {
              Alert.alert('Error', 'No se pudo conectar con la API');
            } finally {
              setEliminando(false);
            }
          },
        },
      ],
    );
  };

  // Deja iguales las fotos del formulario de edición y las de la ficha abierta
  const actualizarFotos = (lista: Foto[]) => {
    setFotosActuales(lista);
    setDetalle(d => (d ? {...d, imagenes: lista} : d));
  };

  // Quita una foto del anuncio. Los cambios de fotos se guardan al instante.
  const quitarFoto = (f: Foto) => {
    Alert.alert('Quitar foto', '¿Querés quitar esta foto del anuncio?', [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          setMensajeForm('');
          setSubiendoFoto(true);
          try {
            const r = await fetch(`${API_URL}/propiedades/fotos/borrar`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({id_imagen: f.id}),
            });
            const datos = await r.json().catch(() => ({}));
            if (r.ok) {
              actualizarFotos(datos.imagenes ?? []);
            } else {
              setMensajeForm(datos.error ?? 'No se pudo quitar la foto');
            }
          } catch (e) {
            setMensajeForm('No se pudo conectar con la API');
          } finally {
            setSubiendoFoto(false);
          }
        },
      },
    ]);
  };

  // Elige fotos nuevas y las sube al anuncio que se está editando (máximo 6 en total)
  const agregarFotosEdicion = async () => {
    const lugar = 6 - fotosActuales.length;
    if (lugar <= 0) {
      setMensajeForm('El anuncio ya tiene 6 fotos');
      return;
    }
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: lugar,
      quality: 0.7,
      maxWidth: 1600,
      maxHeight: 1600,
    });
    if (res.didCancel) {
      return;
    }
    if (res.errorCode || !res.assets || res.assets.length === 0) {
      setMensajeForm('No se pudo abrir la galería de fotos');
      return;
    }

    setMensajeForm('');
    setSubiendoFoto(true);
    try {
      const formData = new FormData();
      formData.append('id', String(editandoId));
      res.assets.forEach((foto, i) => {
        formData.append('fotos[]', {
          uri: foto.uri,
          type: foto.type ?? 'image/jpeg',
          name: foto.fileName ?? `foto${i + 1}.jpg`,
        } as any);
      });
      const r = await fetch(`${API_URL}/propiedades/fotos/agregar`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
        body: formData,
      });
      const datos = await r.json().catch(() => ({}));
      if (r.status === 201) {
        actualizarFotos(datos.imagenes ?? []);
      } else {
        setMensajeForm(datos.error ?? 'No se pudieron agregar las fotos');
      }
    } catch (e) {
      setMensajeForm('No se pudo conectar con la API');
    } finally {
      setSubiendoFoto(false);
    }
  };

  // Abre la galería para elegir las fotos del anuncio (la API pide de 2 a 6)
  const elegirFotos = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 6,
      quality: 0.7,
      maxWidth: 1600,
      maxHeight: 1600,
    });
    if (res.didCancel) {
      return;
    }
    if (res.errorCode) {
      setMensajeForm('No se pudo abrir la galería de fotos');
      return;
    }
    setFotos(res.assets ?? []);
  };

  // Crear va como multipart con las fotos; editar va como JSON
  const publicarAnuncio = async () => {
    setMensajeForm('');
    if (nDireccion.trim() === '') {
      setMensajeForm('Complete la dirección');
      return;
    }
    if (nPrecio.trim() === '' || isNaN(Number(nPrecio)) || Number(nPrecio) <= 0) {
      setMensajeForm('El precio debe ser un número mayor a 0');
      return;
    }
    if (!/^\d+$/.test(nHabitaciones.trim())) {
      setMensajeForm('Los ambientes deben ser un número entero');
      return;
    }
    if (editandoId === null && fotos.length < 2) {
      setMensajeForm('Elegí al menos 2 fotos del inmueble');
      return;
    }
    setEnviando(true);
    try {
      const editando = editandoId !== null;

      // Para crear: texto + fotos en multipart (React Native arma el Content-Type solo)
      const formData = new FormData();
      if (!editando) {
        formData.append('direccion', nDireccion.trim());
        formData.append('precio', String(Number(nPrecio)));
        formData.append('habitaciones', String(Number(nHabitaciones)));
        formData.append('descripcion', nDescripcion.trim());
        fotos.forEach((foto, i) => {
          formData.append('fotos[]', {
            uri: foto.uri,
            type: foto.type ?? 'image/jpeg',
            name: foto.fileName ?? `foto${i + 1}.jpg`,
          } as any);
        });
      }

      const r = editando
        ? await fetch(`${API_URL}/propiedades/editar`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              id: editandoId,
              direccion: nDireccion.trim(),
              precio: Number(nPrecio),
              habitaciones: Number(nHabitaciones),
              descripcion: nDescripcion.trim(),
            }),
          })
        : await fetch(`${API_URL}/propiedades/crear`, {
            method: 'POST',
            headers: {Authorization: `Bearer ${token}`},
            body: formData,
          });
      const datos = await r.json();
      if (editando && r.ok) {
        const id = editandoId as number;
        limpiarFormulario();
        cerrarFormulario();
        abrirDetalle(id);
        cargarPropiedades(filtro);
        Alert.alert('Listo', 'Anuncio actualizado');
      } else if (!editando && r.status === 201) {
        setNDireccion('');
        setNPrecio('');
        setNHabitaciones('');
        setNDescripcion('');
        setFotos([]);
        cerrarFormulario();
        setFiltro('');
        cargarPropiedades('');
        Alert.alert('Listo', 'Anuncio creado exitosamente');
      } else {
        setMensajeForm(datos.error ?? 'No se pudo guardar el anuncio');
      }
    } catch (e) {
      setMensajeForm('No se pudo conectar con la API');
    } finally {
      setEnviando(false);
    }
  };

  useEffect(() => {
    if (token !== null) {
      cargarPropiedades('');
    }
  }, [token]);

  // El botón "atrás" del celular retrocede una pantalla
  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      if (token === null && modo === 'registro') {
        if (rolReg !== '') {
          setRolReg('');
        } else {
          setModo('login');
        }
        return true;
      }
      if (publicando) {
        cerrarFormulario();
        return true;
      }
      if (idDetalle !== null) {
        cerrarDetalle();
        return true;
      }
      return false;
    });
    return () => s.remove();
  }, [idDetalle, publicando, modo, rolReg, token]);

  const salir = () => {
    setToken(null);
    setRol('');
    setEmail('');
    setMensaje('');
    setPropiedades([]);
    setFiltro('');
    setMensajeLista('');
    setModo('login');
    cerrarDetalle();
    cerrarFormulario();
  };

  const Cabecera = (p: {titulo: string; onVolver: () => void}) => (
    <View style={st.barra}>
      <Boton titulo="‹ Volver" tipo="texto" onPress={p.onVolver} />
      <Text style={st.barraTitulo}>{p.titulo}</Text>
      <View style={{width: 90}} />
    </View>
  );

  // Publicar anuncio
  if (token !== null && publicando) {
    return (
      <SafeAreaView style={st.pantalla}>
        <StatusBar barStyle="dark-content" />
        <Cabecera
          titulo={editandoId !== null ? 'Editar anuncio' : 'Nuevo anuncio'}
          onVolver={cerrarFormulario}
        />
        <ScrollView contentContainerStyle={st.formulario} keyboardShouldPersistTaps="handled">
          <Campo placeholder="Dirección" value={nDireccion} onChangeText={setNDireccion} />
          <Campo placeholder="Precio mensual" keyboardType="numeric" value={nPrecio} onChangeText={setNPrecio} />
          <Campo placeholder="Cantidad de ambientes" keyboardType="numeric" value={nHabitaciones} onChangeText={setNHabitaciones} />
          <Campo
            placeholder="Descripción (opcional)"
            multiline
            style={st.inputLargo}
            value={nDescripcion}
            onChangeText={setNDescripcion}
          />
          {editandoId === null && (
            <View style={st.fotosCaja}>
              <Boton
                titulo={
                  fotos.length === 0
                    ? 'Elegir fotos (mínimo 2, máximo 6)'
                    : `Cambiar fotos (${fotos.length} elegidas)`
                }
                tipo="secundario"
                onPress={elegirFotos}
              />
              {fotos.length > 0 && (
                <View style={st.fotosFila}>
                  {fotos.map((f, i) => (
                    <Image key={i} source={{uri: f.uri}} style={st.miniatura} />
                  ))}
                </View>
              )}
            </View>
          )}
          {editandoId !== null && (
            <View style={st.fotosCaja}>
              <Text style={st.seccion}>Fotos ({fotosActuales.length} de 6)</Text>
              <View style={st.fotosFila}>
                {fotosActuales.map(f => (
                  <View key={f.id} style={st.fotoEditable}>
                    <Image source={{uri: urlFoto(f.ruta_url)}} style={st.miniatura} />
                    <TouchableOpacity onPress={() => quitarFoto(f)} disabled={subiendoFoto}>
                      <Text style={st.quitarFoto}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {subiendoFoto ? (
                <ActivityIndicator size="small" color={C.verde} />
              ) : fotosActuales.length < 6 ? (
                <Boton titulo="Agregar fotos" tipo="secundario" onPress={agregarFotosEdicion} />
              ) : null}
              <Text style={st.notaFotos}>
                El anuncio debe tener entre 2 y 6 fotos. Los cambios en las fotos se guardan al instante.
              </Text>
            </View>
          )}
          {mensajeForm !== '' && <Text style={st.error}>{mensajeForm}</Text>}
          {enviando ? (
            <ActivityIndicator size="large" color={C.verde} />
          ) : (
            <Boton
              titulo={editandoId !== null ? 'Guardar cambios' : 'Publicar anuncio'}
              onPress={publicarAnuncio}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Detalle
  if (token !== null && idDetalle !== null) {
    // Solo el propietario que publicó este anuncio ve editar y eliminar
    const esDuenio =
      detalle !== null &&
      rol === 'Propietario' &&
      detalle.email_contacto.trim().toLowerCase() === email.trim().toLowerCase();
    return (
      <SafeAreaView style={st.pantalla}>
        <StatusBar barStyle="dark-content" />
        <Cabecera titulo="Detalle" onVolver={cerrarDetalle} />
        {cargandoDetalle && <ActivityIndicator size="large" color={C.verde} style={st.cargador} />}
        {mensajeDetalle !== '' && <Text style={st.vacio}>{mensajeDetalle}</Text>}
        {detalle !== null && (
          <ScrollView contentContainerStyle={st.formulario}>
            {detalle.imagenes && detalle.imagenes.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={e =>
                    setFotoActual(Math.round(e.nativeEvent.contentOffset.x / ANCHO_FOTO))
                  }>
                  {detalle.imagenes.map(f => (
                    <Image key={f.id} source={{uri: urlFoto(f.ruta_url)}} style={st.fotoGrande} />
                  ))}
                </ScrollView>
                <Text style={st.contadorFotos}>
                  {fotoActual + 1} / {detalle.imagenes.length}
                </Text>
              </View>
            )}
            <View style={st.precioEtiqueta}>
              <Text style={st.precioGrande}>{formatearPrecio(detalle.precio)}</Text>
              <Text style={st.precioMes}>por mes</Text>
            </View>
            <Text style={st.tituloDireccion}>{detalle.direccion}</Text>
            <View style={st.fichas}>
              <Text style={st.ficha}>{textoAmbientes(detalle.habitaciones)}</Text>
            </View>

            <Text style={st.seccion}>Descripción</Text>
            <Text style={st.cuerpo}>{detalle.descripcion || 'Sin descripción'}</Text>

            <Text style={st.seccion}>Contacto</Text>
            <View style={st.contacto}>
              <Text style={st.contactoNombre}>{detalle.propietario}</Text>
              <Text style={st.cuerpo}>{detalle.email_contacto}</Text>
              <Text style={st.cuerpo}>{detalle.contacto ?? 'Teléfono no informado'}</Text>
            </View>
            {detalle.contacto !== null && (
              <Boton titulo="Llamar al propietario" onPress={() => Linking.openURL(`tel:${detalle.contacto}`)} />
            )}

            {esDuenio && (
              <View style={st.acciones}>
                <Text style={st.seccion}>Tu anuncio</Text>
                <Boton titulo="Editar anuncio" tipo="secundario" onPress={() => abrirEdicion(detalle)} />
                {eliminando ? (
                  <ActivityIndicator size="large" color={C.error} />
                ) : (
                  <Boton titulo="Eliminar anuncio" tipo="peligro" onPress={() => eliminarAnuncio(detalle.id)} />
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // Catálogo
  if (token !== null) {
    return (
      <SafeAreaView style={st.pantalla}>
        <StatusBar barStyle="light-content" />
        <View style={st.encabezado}>
          <View>
            <Text style={st.marcaChica}>AlquileresFsa</Text>
            <Text style={st.sesion}>Sesión de {rol}</Text>
          </View>
          <TouchableOpacity onPress={salir} style={st.salir}>
            <Text style={st.salirLetra}>Salir</Text>
          </TouchableOpacity>
        </View>

        <View style={st.buscador}>
          <Campo
            placeholder="Ambientes (ej: 3)"
            keyboardType="numeric"
            style={{flex: 1}}
            value={filtro}
            onChangeText={setFiltro}
            onSubmitEditing={() => cargarPropiedades(filtro)}
          />
          <TouchableOpacity style={st.botonBuscar} onPress={() => cargarPropiedades(filtro)}>
            <Text style={st.botonBuscarLetra}>Buscar</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={st.verTodas}
          onPress={() => {
            setFiltro('');
            cargarPropiedades('');
          }}>
          <Text style={st.verTodasLetra}>Ver todas las propiedades</Text>
        </TouchableOpacity>

        {cargandoLista ? (
          <ActivityIndicator size="large" color={C.verde} style={st.cargador} />
        ) : (
          <FlatList
            data={propiedades}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={st.lista}
            ListEmptyComponent={<Text style={st.vacio}>{mensajeLista || 'No hay propiedades disponibles'}</Text>}
            renderItem={({item}) => (
              <TouchableOpacity activeOpacity={0.85} style={st.tarjeta} onPress={() => abrirDetalle(item.id)}>
                <View style={st.tarjetaPrecio}>
                  <Text style={st.tarjetaPrecioLetra}>{formatearPrecio(item.precio)}</Text>
                </View>
                <Text style={st.direccion}>{item.direccion}</Text>
                <View style={st.fichas}>
                  <Text style={st.ficha}>{textoAmbientes(item.habitaciones)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {rol === 'Propietario' && (
          <View style={st.pie}>
            <Boton titulo="Publicar un alquiler" onPress={abrirNuevo} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Registro, paso 1: elegir el motivo
  if (modo === 'registro' && rolReg === '') {
    return (
      <SafeAreaView style={st.pantalla}>
        <StatusBar barStyle="dark-content" />
        <Cabecera titulo="Crear cuenta" onVolver={() => setModo('login')} />
        <View style={st.formulario}>
          <Text style={st.pregunta}>¿Qué querés hacer en AlquileresFsa?</Text>
          <TouchableOpacity style={st.opcion} onPress={() => setRolReg('Inquilino')}>
            <Text style={st.opcionTitulo}>Quiero alquilar</Text>
            <Text style={st.opcionTexto}>Mirá las propiedades del barrio y contactá al dueño.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.opcion} onPress={() => setRolReg('Propietario')}>
            <Text style={st.opcionTitulo}>Quiero publicar alquileres</Text>
            <Text style={st.opcionTexto}>Pedimos DNI y una declaración jurada para verificar tus datos.</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Registro, paso 2: formulario
  if (modo === 'registro') {
    const esProp = rolReg === 'Propietario';
    return (
      <SafeAreaView style={st.pantalla}>
        <StatusBar barStyle="dark-content" />
        <Cabecera titulo={esProp ? 'Registro para publicar' : 'Registro para alquilar'} onVolver={() => setRolReg('')} />
        <ScrollView contentContainerStyle={st.formulario} keyboardShouldPersistTaps="handled">
          <Campo placeholder="Nombre y apellido" value={rNombre} onChangeText={setRNombre} />
          <Campo placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={rEmail} onChangeText={setREmail} />
          <Campo placeholder="Contraseña (mínimo 6 caracteres)" secureTextEntry value={rPass} onChangeText={setRPass} />
          <Campo placeholder="Repetir contraseña" secureTextEntry value={rPass2} onChangeText={setRPass2} />
          <Campo
            placeholder={esProp ? 'Teléfono (10 dígitos, ej: 3704123456)' : 'Teléfono (opcional)'}
            keyboardType="numeric"
            maxLength={10}
            value={rTelefono}
            onChangeText={setRTelefono}
          />
          {esProp && (
            <>
              <Text style={st.seccion}>Verificación de identidad</Text>
              <Campo placeholder="DNI (solo números)" keyboardType="numeric" maxLength={8} value={rDni} onChangeText={setRDni} />
              <Campo placeholder="Dirección (mínimo 10 caracteres)" value={rDireccion} onChangeText={setRDireccion} />
              <View style={st.filaSwitch}>
                <Switch value={rDeclaracion} onValueChange={setRDeclaracion} trackColor={{true: C.verde, false: C.linea}} thumbColor="#fff" />
                <Text style={st.textoSwitch}>
                  Declaro bajo juramento que los datos son verdaderos y que soy el propietario o estoy autorizado a alquilar los inmuebles que publique.
                </Text>
              </View>
            </>
          )}
          {rMensaje !== '' && <Text style={st.error}>{rMensaje}</Text>}
          {rEnviando ? <ActivityIndicator size="large" color={C.verde} /> : <Boton titulo="Crear cuenta" onPress={registrar} />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Login
  return (
    <SafeAreaView style={st.loginFondo}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={st.loginScroll} keyboardShouldPersistTaps="handled">
      <View style={st.loginMarca}>
        <Text style={st.logo}>AlquileresFsa</Text>
        <Text style={st.lema}>Alquileres de tu barrio, sin vueltas.</Text>
      </View>
      <View style={st.loginPanel}>
        <Campo placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Campo placeholder="Contraseña" secureTextEntry value={pass} onChangeText={setPass} />
        {mensaje !== '' && <Text style={st.error}>{mensaje}</Text>}
        {cargando ? <ActivityIndicator size="large" color={C.verde} /> : <Boton titulo="Ingresar" onPress={ingresar} />}
        <Text style={st.o}>¿Todavía no tenés cuenta?</Text>
        <Boton
          titulo="Crear cuenta"
          tipo="secundario"
          onPress={() => {
            setMensaje('');
            setModo('registro');
          }}
        />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  // Base
  pantalla: {flex: 1, backgroundColor: C.fondo},
  formulario: {padding: 20, paddingBottom: 56, gap: 14},
  error: {color: C.error, fontSize: 14, textAlign: 'center'},
  cargador: {marginTop: 32},
  vacio: {textAlign: 'center', color: C.suave, fontSize: 16, marginTop: 40, paddingHorizontal: 24},

  // Botones y campos
  boton: {borderRadius: 28, minHeight: 50, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center'},
  botonPrimario: {backgroundColor: C.verde},
  botonSecundario: {borderWidth: 1.5, borderColor: C.verde, backgroundColor: 'transparent'},
  botonTexto: {paddingHorizontal: 0, alignItems: 'flex-start', width: 90},
  botonPeligro: {borderWidth: 1.5, borderColor: C.error, backgroundColor: 'transparent'},
  botonLetra: {fontSize: 16, fontWeight: '700', textAlign: 'center'},
  input: {
    backgroundColor: C.papel,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: C.texto,
  },
  inputLargo: {minHeight: 100, textAlignVertical: 'top'},

  // Login
  loginFondo: {flex: 1, backgroundColor: C.oscuro},
  loginScroll: {flexGrow: 1, justifyContent: 'flex-end'},
  loginMarca: {flexGrow: 1, minHeight: 120, justifyContent: 'flex-end', padding: 28, paddingBottom: 36},
  logo: {fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -0.5},
  lema: {fontSize: 16, color: C.melon, marginTop: 6},
  loginPanel: {
    backgroundColor: C.fondo,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    paddingBottom: 32,
    gap: 14,
  },
  o: {textAlign: 'center', color: C.suave, fontSize: 14, marginTop: 6},

  // Barras
  barra: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14 + ALTO_BARRA},
  barraTitulo: {fontSize: 17, fontWeight: '700', color: C.texto, flexShrink: 1, textAlign: 'center'},
  encabezado: {
    backgroundColor: C.oscuro,
    paddingHorizontal: 20,
    paddingTop: 16 + ALTO_BARRA,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marcaChica: {fontSize: 20, fontWeight: '800', color: '#fff'},
  sesion: {fontSize: 13, color: C.verdeClaro, marginTop: 2},
  salir: {borderWidth: 1, borderColor: C.verdeClaro, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7},
  salirLetra: {color: '#fff', fontWeight: '600'},

  // Catálogo
  buscador: {flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16},
  botonBuscar: {backgroundColor: C.verde, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center'},
  botonBuscarLetra: {color: '#fff', fontWeight: '700', fontSize: 15},
  verTodas: {paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4},
  verTodasLetra: {color: C.verde, fontWeight: '600', fontSize: 14},
  lista: {padding: 20, gap: 14, paddingBottom: 140},
  tarjeta: {
    backgroundColor: C.papel,
    borderRadius: 20,
    padding: 18,
    borderLeftWidth: 6,
    borderLeftColor: C.melon,
    elevation: 2,
  },
  tarjetaPrecio: {alignSelf: 'flex-start', backgroundColor: C.melon, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4},
  tarjetaPrecioLetra: {fontSize: 18, fontWeight: '800', color: C.texto},
  direccion: {fontSize: 18, fontWeight: '600', color: C.texto, marginTop: 10},
  fichas: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8},
  ficha: {backgroundColor: C.verdeClaro, color: C.verde, fontSize: 13, fontWeight: '600', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden'},
  pie: {position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 32, backgroundColor: C.fondo, borderTopWidth: 1, borderTopColor: C.linea},

  // Detalle
  precioEtiqueta: {flexDirection: 'row', alignItems: 'baseline', gap: 8},
  precioGrande: {fontSize: 34, fontWeight: '800', color: C.verde},
  precioMes: {fontSize: 15, color: C.suave},
  tituloDireccion: {fontSize: 22, fontWeight: '700', color: C.texto},
  seccion: {fontSize: 17, fontWeight: '700', color: C.texto, marginTop: 8},
  cuerpo: {fontSize: 15, color: C.texto, lineHeight: 22},
  contacto: {backgroundColor: C.papel, borderRadius: 12, padding: 16, gap: 4, borderWidth: 1, borderColor: C.linea},
  contactoNombre: {fontSize: 17, fontWeight: '700', color: C.texto},
  acciones: {gap: 12, marginTop: 8},
  fotosCaja: {gap: 10},
  fotosFila: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  miniatura: {width: 72, height: 72, borderRadius: 10, backgroundColor: C.verdeClaro},
  fotoEditable: {alignItems: 'center', gap: 4},
  quitarFoto: {color: C.error, fontWeight: '700', fontSize: 14},
  notaFotos: {fontSize: 13, color: C.suave},
  fotoGrande: {width: ANCHO_FOTO, height: 230, borderRadius: 16, backgroundColor: C.verdeClaro},
  contadorFotos: {textAlign: 'right', color: C.suave, fontSize: 13, marginTop: 6},

  // Registro
  pregunta: {fontSize: 22, fontWeight: '700', color: C.texto, marginBottom: 6},
  opcion: {backgroundColor: C.papel, borderRadius: 22, padding: 20, borderWidth: 1.5, borderColor: C.verde, gap: 6},
  opcionTitulo: {fontSize: 19, fontWeight: '700', color: C.verde},
  opcionTexto: {fontSize: 14, color: C.suave, lineHeight: 20},
  filaSwitch: {flexDirection: 'row', alignItems: 'center', gap: 12},
  textoSwitch: {flex: 1, fontSize: 13, color: C.texto, lineHeight: 19},
});

export default App;